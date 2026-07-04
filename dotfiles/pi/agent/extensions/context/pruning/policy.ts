import { hashNormalizedContent, normalizedToolName } from "../content.js";
import {
  PRUNE_TOKEN_THRESHOLD,
  STALE_LARGE_MIN_AGE,
  type PruneReason,
  type StubDecision,
  type ToolResultCandidate,
} from "../types.js";
import { estimateToolResultTokens } from "./savings.js";

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

const IGNORED_TOOL_NAMES = new Set(["question", "multi_tool_use.parallel"]);

export function pruningPolicyFor(
  toolName: string,
): ReadonlySet<PruneReason> | undefined {
  return TOOL_PRUNING_POLICY.get(normalizedToolName(toolName));
}

export function isIgnoredTool(toolName: string): boolean {
  return IGNORED_TOOL_NAMES.has(normalizedToolName(toolName));
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

export function decideStubs(
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
