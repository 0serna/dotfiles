import { isAvailable } from "./rotation.js";
import type { QuotaSnapshot, SourceIdentity } from "./snapshot.js";
import type { AccountConfig, AccountState, OpenCodeGoData } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Candidate = {
  stateIndex: number;
  account: AccountConfig;
  data: OpenCodeGoData;
};

function toOpenCodeData(
  windows: NonNullable<import("./snapshot.js").SourceRecord["windows"]>,
  now: number,
): OpenCodeGoData {
  const secondsNow = now / 1000;
  return {
    monthly: windows.monthly
      ? {
          remainingPercent: windows.monthly.remainingPercent,
          resetInSec: Math.max(0, windows.monthly.resetAt - secondsNow),
        }
      : undefined,
    weekly: windows.weekly
      ? {
          remainingPercent: windows.weekly.remainingPercent,
          resetInSec: Math.max(0, windows.weekly.resetAt - secondsNow),
        }
      : undefined,
    rolling: windows.rolling
      ? {
          remainingPercent: windows.rolling.remainingPercent,
          resetInSec: Math.max(0, windows.rolling.resetAt - secondsNow),
        }
      : undefined,
  };
}

function hasAllWindows(data: OpenCodeGoData): boolean {
  return Boolean(
    data.monthly &&
    data.weekly &&
    data.rolling &&
    data.monthly.remainingPercent > 0 &&
    data.weekly.remainingPercent > 0 &&
    data.rolling.remainingPercent > 0,
  );
}

function quotaScore(data: OpenCodeGoData): [number, number, number, number] {
  const monthly = data.monthly!.remainingPercent;
  const weekly = data.weekly!.remainingPercent;
  const rolling = data.rolling!.remainingPercent;
  return [Math.min(monthly, weekly, rolling), monthly, weekly, rolling];
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const leftScore = quotaScore(left.data);
  const rightScore = quotaScore(right.data);
  for (let i = 0; i < leftScore.length; i++) {
    if (leftScore[i]! !== rightScore[i]!) {
      return leftScore[i]! > rightScore[i]! ? 1 : -1;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select the best OpenCode account using only the shared snapshot. Returns
 * the `accountStates` index of the chosen account, or -1 when no eligible
 * observation exists.
 */
export function selectFromSnapshot(
  snapshot: QuotaSnapshot,
  states: ReadonlyArray<AccountState>,
  accounts: ReadonlyArray<AccountConfig>,
  now: number,
): number {
  const candidates: Candidate[] = [];

  for (const account of accounts) {
    const stateIndex = states.findIndex((state) => state.name === account.name);
    if (stateIndex < 0) continue;
    const state = states[stateIndex];
    if (!state || !isAvailable(state, now)) continue;

    const identity: SourceIdentity = {
      providerId: "opencode-go",
      sourceId: `opencode-go:${account.name}`,
    };
    const key = `${identity.providerId}/${identity.sourceId}`;
    const record = snapshot.sources[key];
    if (!record) continue;
    if (record.state === "expired" || record.state === "unavailable") continue;
    if (record.providerExhaustion) continue;
    if (!record.windows) continue;

    const data = toOpenCodeData(record.windows, now);
    if (!hasAllWindows(data)) continue;

    candidates.push({ stateIndex, account, data });
  }

  if (candidates.length === 0) return -1;

  let bestIndex = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (compareCandidates(candidates[i]!, candidates[bestIndex]!) > 0) {
      bestIndex = i;
    }
  }
  return candidates[bestIndex]!.stateIndex;
}
