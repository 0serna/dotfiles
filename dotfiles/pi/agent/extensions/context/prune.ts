import { estimateTokens as estimateMessageTokens } from "@earendil-works/pi-coding-agent";
import { accessSync, chmodSync, constants, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";
import {
  asRecord,
  extractTextContent,
  hashNormalizedContent,
  normalizedToolName,
  replaceTextContent,
} from "./content.js";
import { collectToolCallMetadata, metadataForToolResult } from "./metadata.js";
import {
  PRUNE_TOKEN_THRESHOLD,
  STALE_LARGE_MIN_AGE,
  type PruneMetrics,
  type PruneOptions,
  type PruneReason,
  type StubDecision,
  type ToolResultCandidate,
} from "./types.js";

const TOOL_PRUNING_POLICY: ReadonlyMap<
  string,
  ReadonlySet<PruneReason>
> = new Map<string, ReadonlySet<PruneReason>>(
  Object.entries({
    read: new Set<PruneReason>(["superseded"]),
    edit: new Set<PruneReason>(["stale_large"]),
    write: new Set<PruneReason>(["superseded", "stale_large"]),
    bash: new Set<PruneReason>(["duplicate", "resolved", "stale_large"]),
    web_fetch: new Set<PruneReason>(["duplicate", "stale_large"]),
    web_search: new Set<PruneReason>(["stale_large"]),
  }),
);

function pruningPolicyFor(
  toolName: string,
): ReadonlySet<PruneReason> | undefined {
  return TOOL_PRUNING_POLICY.get(normalizedToolName(toolName));
}

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

const IGNORED_TOOL_NAMES = new Set(["question", "multi_tool_use.parallel"]);
const DCP_DIRECTORY_MODE = 0o700;
const DCP_FILE_MODE = 0o600;

function isIgnoredTool(toolName: string): boolean {
  return IGNORED_TOOL_NAMES.has(normalizedToolName(toolName));
}

const PI_BASH_FULL_OUTPUT_FILE_PATTERN = /^pi-bash-[A-Za-z0-9]+\.log$/;

function isReusableFullOutputPath(filePath: string): boolean {
  if (dirname(filePath) !== tmpdir()) return false;
  if (!PI_BASH_FULL_OUTPUT_FILE_PATTERN.test(basename(filePath))) return false;

  try {
    accessSync(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function extractFullOutputPath(text: string): string | null {
  const match = text.match(/Full output:\s*([^\s\]]+)/);
  const filePath = match?.[1];
  return filePath !== undefined && isReusableFullOutputPath(filePath)
    ? filePath
    : null;
}

function buildStub(reason: PruneReason, savedPath?: string): string {
  return savedPath
    ? `[DCP pruned transient output: reason=${reason}; saved=${savedPath}]`
    : `[DCP pruned transient output: reason=${reason}]`;
}

function emptyReasonCounts(): Record<PruneReason, number> {
  return {
    duplicate: 0,
    resolved: 0,
    superseded: 0,
    stale_large: 0,
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
  const stubText = buildStub(decision.reason);

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
  const candidates: ToolResultCandidate[] = [];

  messages.forEach((messageValue, index) => {
    const message = asRecord(messageValue);
    if (message === null || !isToolResult(message)) return;

    const text = extractTextContent(message);
    if (text === null) return;

    const metadata = metadataForToolResult(message, toolCalls);
    if (metadata === null || isIgnoredTool(metadata.toolName)) return;

    const policy = pruningPolicyFor(metadata.toolName);
    if (policy === undefined) return;

    candidates.push({
      index,
      message,
      text,
      isError: isErrorResult(message, text),
      metadata,
      dcpAge: 0,
      policy,
    });
  });

  return candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    dcpAge: candidates.length - candidateIndex - 1,
  }));
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
    if (
      !candidate.isError &&
      candidate.metadata.semanticOperationKey !== null
    ) {
      laterSuccesses.add(candidate.metadata.semanticOperationKey);
    }
  }

  return result;
}

function laterSupersedeTargetsByIndex(
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
      candidate.metadata.supersedeKey !== null
    ) {
      laterTargets.add(candidate.metadata.supersedeKey);
    }
  }

  return result;
}

function laterContentHashesByIndex(
  candidates: readonly ToolResultCandidate[],
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  const laterHashes = new Set<string>();

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    result.set(candidate.index, new Set(laterHashes));
    laterHashes.add(hashNormalizedContent(candidate.text));
  }

  return result;
}

function decideStubs(
  candidates: readonly ToolResultCandidate[],
): StubDecision[] {
  const decisions: StubDecision[] = [];
  const laterContentHashes = laterContentHashesByIndex(candidates);
  const laterSuccessfulOperations = laterSuccessOperationsByIndex(candidates);
  const laterSupersedeTargets = laterSupersedeTargetsByIndex(candidates);

  for (const candidate of candidates) {
    const hash = hashNormalizedContent(candidate.text);

    let reason: PruneReason | null = null;

    if (
      (laterContentHashes.get(candidate.index)?.has(hash) ?? false) &&
      candidate.policy.has("duplicate")
    ) {
      reason = "duplicate";
    } else if (
      candidate.isError &&
      candidate.metadata.semanticOperationKey !== null &&
      (laterSuccessfulOperations
        .get(candidate.index)
        ?.has(candidate.metadata.semanticOperationKey) ??
        false) &&
      candidate.policy.has("resolved")
    ) {
      reason = "resolved";
    } else if (
      candidate.metadata.isFileOperation &&
      candidate.metadata.supersedeKey !== null &&
      (laterSupersedeTargets
        .get(candidate.index)
        ?.has(candidate.metadata.supersedeKey) ??
        false) &&
      candidate.policy.has("superseded")
    ) {
      reason = "superseded";
    } else if (
      candidate.dcpAge > STALE_LARGE_MIN_AGE &&
      estimateToolResultTokens(candidate.text, candidate.metadata.toolName) >
        PRUNE_TOKEN_THRESHOLD &&
      candidate.policy.has("stale_large")
    ) {
      reason = "stale_large";
    }

    if (reason !== null) {
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
    staleLargeProtectedCount: candidates.filter(
      (candidate) =>
        candidate.policy.has("stale_large") &&
        candidate.dcpAge <= STALE_LARGE_MIN_AGE &&
        estimateToolResultTokens(candidate.text, candidate.metadata.toolName) >
          PRUNE_TOKEN_THRESHOLD,
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

function ensurePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: DCP_DIRECTORY_MODE });
  chmodSync(path, DCP_DIRECTORY_MODE);
}

function externalizeOutput(
  text: string,
  sessionId: string,
  sequenceNumber: number,
): string {
  const baseDir = join(tmpdir(), "pi-dcp");
  const dir = join(baseDir, sessionId);
  ensurePrivateDirectory(baseDir);
  ensurePrivateDirectory(dir);

  const filePath = join(dir, `${String(sequenceNumber).padStart(4, "0")}.txt`);
  writeFileSync(filePath, text, { encoding: "utf8", mode: DCP_FILE_MODE });
  chmodSync(filePath, DCP_FILE_MODE);
  return filePath;
}

export function pruneMessages<T>(
  messages: readonly T[],
  options: PruneOptions = {},
): PruneResult<T> {
  try {
    const candidates = collectCandidates(messages);
    const appliedDecisions = decideStubs(candidates).filter(
      (decision) => estimatedSavedTokens(decision) > 0,
    );

    const metrics = metricsFor(
      candidates,
      appliedDecisions,
      options.contextSequence,
    );

    options.logger?.log("context_pruned", { ...metrics });

    if (appliedDecisions.length === 0) {
      return { messages: [...messages], metrics };
    }

    const sessionId = options.sessionId ?? "unknown";
    const replacements = new Map<number, Record<string, unknown>>();

    for (const decision of appliedDecisions) {
      const existingPath = extractFullOutputPath(decision.candidate.text);
      let savedPath: string | undefined;
      if (existingPath !== null) {
        savedPath = existingPath;
      } else {
        try {
          savedPath = externalizeOutput(
            decision.candidate.text,
            sessionId,
            decision.candidate.index,
          );
        } catch {
          savedPath = undefined;
        }
      }

      replacements.set(
        decision.candidate.index,
        replaceTextContent(
          decision.candidate.message,
          buildStub(decision.reason, savedPath),
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
        staleLargeProtectedCount: 0,
        reasonCounts: emptyReasonCounts(),
        estimatedSavedTokens: 0,
        estimatedSavedTokensByReason: emptyReasonCounts(),
        estimatedSavedTokensByTool: {},
        targets: [],
      },
    };
  }
}
