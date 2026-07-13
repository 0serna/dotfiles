import { isObservationUsable } from "./snapshot-transitions.js";
import type { QuotaSnapshot, SourceIdentity } from "./snapshot.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReselectionInput = {
  activeSource?: SourceIdentity;
  /** True when the agent is fully settled and no follow-up work is queued. */
  piSettled: boolean;
  /** True when the runtime activated a blind fallback because no snapshot observation was usable. */
  blindFallback: boolean;
  now: number;
};

export type ReselectionDecision = {
  reselect: boolean;
  reason:
    | "active_unusable"
    | "blind_fallback_reevaluate"
    | "active_usable"
    | "agent_busy";
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decide whether the runtime should re-evaluate OpenCode account selection.
 * A preventive reselection only happens when the active account becomes
 * unusable while Pi is settled, or when a blind-fallback needs a single
 * reevaluation once the first usable snapshot arrives.
 */
export function decidePreventiveReselection(
  snapshot: QuotaSnapshot,
  input: ReselectionInput,
): ReselectionDecision {
  let reason: "active_unusable" | "blind_fallback_reevaluate" | undefined;

  if (input.blindFallback) {
    reason = "blind_fallback_reevaluate";
  } else if (input.activeSource) {
    const key = `${input.activeSource.providerId}/${input.activeSource.sourceId}`;
    const record = snapshot.sources[key];
    if (!record || !isObservationUsable(record)) {
      reason = "active_unusable";
    }
  }

  if (!reason) {
    return { reselect: false, reason: "active_usable" };
  }
  if (!input.piSettled) {
    return { reselect: false, reason: "agent_busy" };
  }
  return { reselect: true, reason };
}
