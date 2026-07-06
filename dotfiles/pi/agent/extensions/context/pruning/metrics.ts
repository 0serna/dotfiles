import {
  PRUNE_TOKEN_THRESHOLD,
  STALE_LARGE_MIN_AGE,
  type PruneMetrics,
  type PruneReason,
  type StubDecision,
  type ToolResultCandidate,
} from "../types.js";
import { estimateToolResultTokens, estimatedSavedTokens } from "./savings.js";

function emptyReasonCounts(): Record<PruneReason, number> {
  return {
    superseded: 0,
    stale_large: 0,
  };
}

export function emptyPruneMetrics(
  contextSequence: number | undefined,
): PruneMetrics {
  return {
    contextSequence,
    processedCount: 0,
    stubbedCount: 0,
    ageGatedCount: 0,
    reasonCounts: emptyReasonCounts(),
    estimatedSavedTokens: 0,
    estimatedSavedTokensByReason: emptyReasonCounts(),
    estimatedSavedTokensByTool: {},
    targets: [],
  };
}

export function metricsFor(
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
    ageGatedCount: candidates.filter(
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
