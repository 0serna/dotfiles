import { estimateTokens as estimateMessageTokens } from "@earendil-works/pi-coding-agent";
import {
  asRecord,
  extractTextContent,
  hashNormalizedContent,
  replaceTextContent,
} from "./content.js";
import { collectToolCallMetadata, metadataForToolResult } from "./metadata.js";
import {
  LARGE_OUTPUT_TOKEN_THRESHOLD,
  RECENT_MESSAGE_COUNT,
  type PruneMetrics,
  type PruneOptions,
  type PruneReason,
  type StubDecision,
  type ToolResultCandidate,
} from "./types.js";

function isToolResult(message: Record<string, unknown>): boolean {
  return message.role === "toolResult";
}

function isErrorResult(
  message: Record<string, unknown>,
  text: string,
): boolean {
  return (
    message.isError === true ||
    /(^|\n)(error|failed|command exited with code [1-9])/i.test(text)
  );
}

const IGNORED_TOOL_NAMES = new Set(["question"]);

function isIgnoredTool(toolName: string): boolean {
  return IGNORED_TOOL_NAMES.has(toolName.toLowerCase());
}

function buildStub(
  reason: PruneReason,
  toolName: string,
  target: string,
): string {
  return `[DCP pruned stale tool result: reason=${reason}; tool=${toolName}; target=${target || "unknown"}. Original output omitted from transient model context only.]`;
}

function emptyReasonCounts(): Record<PruneReason, number> {
  return {
    duplicate_output: 0,
    resolved_error: 0,
    superseded_file_operation: 0,
    old_large_output: 0,
  };
}

function estimateToolResultTokens(text: string, toolName: string): number {
  return estimateMessageTokens({
    role: "toolResult",
    toolCallId: "context-prune-estimate",
    toolName,
    content: [{ type: "text", text }],
    isError: false,
    timestamp: 0,
  });
}

function estimatedSavedTokens(decision: StubDecision): number {
  const toolName = decision.candidate.metadata.toolName;
  const stubText = buildStub(
    decision.reason,
    toolName,
    decision.candidate.metadata.target,
  );

  return Math.max(
    0,
    estimateToolResultTokens(decision.candidate.text, toolName) -
      estimateToolResultTokens(stubText, toolName),
  );
}

function collectCandidates(
  messages: readonly unknown[],
): ToolResultCandidate[] {
  const toolCalls = collectToolCallMetadata(messages);
  const recentStart = Math.max(0, messages.length - RECENT_MESSAGE_COUNT);
  const candidates: ToolResultCandidate[] = [];

  messages.forEach((messageValue, index) => {
    const message = asRecord(messageValue);
    if (message === null || !isToolResult(message)) return;

    const text = extractTextContent(message);
    if (text === null) return;

    const metadata = metadataForToolResult(message, toolCalls);
    if (metadata === null || isIgnoredTool(metadata.toolName)) return;

    candidates.push({
      index,
      message,
      text,
      isError: isErrorResult(message, text),
      metadata,
      protectedRecent: index >= recentStart,
    });
  });

  return candidates;
}

function laterSuccessOperationsByIndex(
  candidates: readonly ToolResultCandidate[],
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  const laterSuccesses = new Set<string>();

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    result.set(candidate.index, new Set(laterSuccesses));
    if (!candidate.isError && candidate.metadata.operationKey !== null) {
      laterSuccesses.add(candidate.metadata.operationKey);
    }
  }

  return result;
}

function laterFileTargetsByIndex(
  candidates: readonly ToolResultCandidate[],
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  const laterTargets = new Set<string>();

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    result.set(candidate.index, new Set(laterTargets));
    if (
      candidate.metadata.isFileOperation &&
      candidate.metadata.operationKey !== null
    ) {
      laterTargets.add(candidate.metadata.target.toLowerCase());
    }
  }

  return result;
}

function decideStubs(
  candidates: readonly ToolResultCandidate[],
): StubDecision[] {
  const decisions: StubDecision[] = [];
  const keptHashes = new Set<string>();
  const laterSuccessfulOperations = laterSuccessOperationsByIndex(candidates);
  const laterFileTargets = laterFileTargetsByIndex(candidates);

  for (const candidate of candidates) {
    const hash = hashNormalizedContent(candidate.text);

    if (candidate.protectedRecent) {
      keptHashes.add(hash);
      continue;
    }

    let reason: PruneReason | null = null;

    if (keptHashes.has(hash)) {
      reason = "duplicate_output";
    } else if (
      candidate.isError &&
      candidate.metadata.operationKey !== null &&
      (laterSuccessfulOperations
        .get(candidate.index)
        ?.has(candidate.metadata.operationKey) ??
        false)
    ) {
      reason = "resolved_error";
    } else if (
      candidate.metadata.isFileOperation &&
      candidate.metadata.operationKey !== null &&
      (laterFileTargets
        .get(candidate.index)
        ?.has(candidate.metadata.target.toLowerCase()) ??
        false)
    ) {
      reason = "superseded_file_operation";
    } else if (
      estimateToolResultTokens(candidate.text, candidate.metadata.toolName) >
      LARGE_OUTPUT_TOKEN_THRESHOLD
    ) {
      reason = "old_large_output";
    }

    if (reason === null) {
      keptHashes.add(hash);
    } else {
      decisions.push({ candidate, reason });
    }
  }

  return decisions;
}

function metricsFor(
  candidates: readonly ToolResultCandidate[],
  decisions: readonly StubDecision[],
  contextSequence: number | undefined,
): PruneMetrics {
  const reasonCounts = emptyReasonCounts();
  const estimatedSavedTokensByReason = emptyReasonCounts();
  const estimatedSavedTokensByTool: Record<string, number> = {};
  const targets: PruneMetrics["targets"] = [];
  let totalEstimatedSavedTokens = 0;

  for (const decision of decisions) {
    const savedTokens = estimatedSavedTokens(decision);
    const toolName = decision.candidate.metadata.toolName;

    reasonCounts[decision.reason] += 1;
    estimatedSavedTokensByReason[decision.reason] += savedTokens;
    estimatedSavedTokensByTool[toolName] =
      (estimatedSavedTokensByTool[toolName] ?? 0) + savedTokens;
    totalEstimatedSavedTokens += savedTokens;
    targets.push({
      index: decision.candidate.index,
      reason: decision.reason,
      toolName,
      target: decision.candidate.metadata.target,
    });
  }

  return {
    contextSequence,
    processedCount: candidates.length,
    stubbedCount: decisions.length,
    protectedRecentCount: candidates.filter(
      (candidate) => candidate.protectedRecent,
    ).length,
    reasonCounts,
    estimatedSavedTokens: totalEstimatedSavedTokens,
    estimatedSavedTokensByReason,
    estimatedSavedTokensByTool,
    targets,
  };
}

export type PruneResult<T> = {
  messages: T[];
  metrics: PruneMetrics;
};

export function pruneMessages<T>(
  messages: readonly T[],
  options: PruneOptions = {},
): PruneResult<T> {
  try {
    const candidates = collectCandidates(messages);
    const decisions = decideStubs(candidates);
    const metrics = metricsFor(candidates, decisions, options.contextSequence);

    options.logger?.log("context_pruned", { ...metrics });

    if (decisions.length === 0) {
      return { messages: [...messages], metrics };
    }

    const replacements = new Map<number, Record<string, unknown>>();
    for (const decision of decisions) {
      replacements.set(
        decision.candidate.index,
        replaceTextContent(
          decision.candidate.message,
          buildStub(
            decision.reason,
            decision.candidate.metadata.toolName,
            decision.candidate.metadata.target,
          ),
        ),
      );
    }

    return {
      messages: messages.map(
        (message, index) =>
          (replacements.get(index) as T | undefined) ?? message,
      ),
      metrics,
    };
  } catch {
    return {
      messages: [...messages],
      metrics: {
        contextSequence: options.contextSequence,
        processedCount: 0,
        stubbedCount: 0,
        protectedRecentCount: 0,
        reasonCounts: emptyReasonCounts(),
        estimatedSavedTokens: 0,
        estimatedSavedTokensByReason: emptyReasonCounts(),
        estimatedSavedTokensByTool: {},
        targets: [],
      },
    };
  }
}
