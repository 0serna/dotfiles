import { collectCandidates } from "./pruning/candidates.js";
import { emptyPruneMetrics, metricsFor } from "./pruning/metrics.js";
import { decideStubs } from "./pruning/policy.js";
import { estimatedSavedTokens } from "./pruning/savings.js";
import { applyStubs } from "./pruning/stub.js";
import type { PruneMetrics, PruneOptions } from "./types.js";

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

    return {
      messages: applyStubs(
        messages,
        appliedDecisions,
        options.sessionId ?? "unknown",
      ),
      metrics,
    };
  } catch {
    return {
      messages: [...messages],
      metrics: emptyPruneMetrics(options.contextSequence),
    };
  }
}
