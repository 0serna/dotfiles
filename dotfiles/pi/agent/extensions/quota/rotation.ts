import type { AccountConfig, AccountState, OpenCodeGoData } from "./types.js";

// ---------------------------------------------------------------------------
// Pure account rotation logic
// ---------------------------------------------------------------------------

export const DEFAULT_COOLDOWN_MS = 60_000;

export type RotationReason = "rate-limited" | "unauthorized";

export type AccountQuotaCandidate = {
  account: AccountConfig;
  data: OpenCodeGoData | null;
};

/**
 * Build initial rotation state from account configuration.
 * Accounts whose API key environment variable is unset are ignored.
 */
export function initAccountStates(
  accounts: ReadonlyArray<AccountConfig>,
  env: NodeJS.ProcessEnv = process.env,
): AccountState[] {
  return accounts
    .map((account): AccountState | null => {
      const apiKey = env[account.apiKeyEnv]?.trim();
      if (!apiKey) return null;
      return {
        name: account.name,
        apiKey,
        lastStatus: "untried",
        cooldownUntil: 0,
        failures: 0,
      };
    })
    .filter((state): state is AccountState => state != null);
}

/** Returns true when the account is not currently in cooldown. */
export function isAvailable(state: AccountState, now: number): boolean {
  return state.cooldownUntil <= now;
}

/** Return true when the errorMessage contains the GoUsageLimitError token. */
export function isQuotaExhaustionError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  return errorMessage.includes("GoUsageLimitError");
}

/** Return true only when all provider quota windows have remaining usage. */
export function hasUsableQuota(data: OpenCodeGoData | null): boolean {
  return (
    data != null &&
    data.monthly != null &&
    data.monthly.remainingPercent > 0 &&
    data.weekly != null &&
    data.weekly.remainingPercent > 0 &&
    data.rolling != null &&
    data.rolling.remainingPercent > 0
  );
}

function quotaScore(data: OpenCodeGoData): [number, number, number, number] {
  const monthly = data.monthly!.remainingPercent;
  const weekly = data.weekly!.remainingPercent;
  const rolling = data.rolling!.remainingPercent;
  return [Math.min(monthly, weekly, rolling), monthly, weekly, rolling];
}

function compareQuota(left: OpenCodeGoData, right: OpenCodeGoData): number {
  const leftScore = quotaScore(left);
  const rightScore = quotaScore(right);
  for (let i = 0; i < leftScore.length; i++) {
    if (leftScore[i]! !== rightScore[i]!) {
      return leftScore[i]! > rightScore[i]! ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Select the most balanced account by maximizing its smallest quota window.
 * Ties are resolved by monthly, weekly, then rolling remaining usage.
 * Returns the candidate index, or -1 when no candidate is eligible.
 */
export function pickBestQuotaAccount(
  candidates: ReadonlyArray<AccountQuotaCandidate>,
): number {
  let bestIndex = -1;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const data = candidate.data;
    if (data == null || !hasUsableQuota(data)) continue;

    const bestData = candidates[bestIndex]?.data;
    if (
      bestIndex === -1 ||
      (bestData != null && compareQuota(data, bestData) > 0)
    ) {
      bestIndex = i;
    }
  }

  return bestIndex;
}

/** Mark an account as bad and place it on cooldown. */
export function markBad(
  state: AccountState,
  reason: RotationReason,
  cooldownMs: number,
  now: number,
): void {
  state.lastStatus = reason;
  state.cooldownUntil = now + cooldownMs;
  state.failures += 1;
}

/**
 * Pick the next account to use.
 *
 * Priority:
 * 1. The account at `currentIndex` if it is still available.
 * 2. The next available account in rotation order.
 * 3. If all accounts are on cooldown, the one whose cooldown expires soonest.
 *
 * Returns the selected index, or -1 if there are no accounts.
 */
export function pickNextAccount(
  states: AccountState[],
  currentIndex: number,
  now: number,
): number {
  if (states.length === 0) return -1;

  const preferred = states[currentIndex];
  if (preferred && isAvailable(preferred, now)) {
    return currentIndex;
  }

  for (let offset = 1; offset <= states.length; offset++) {
    const idx = (currentIndex + offset) % states.length;
    const state = states[idx];
    if (state && isAvailable(state, now)) {
      return idx;
    }
  }

  let bestIdx = 0;
  let bestState = states[0]!;
  for (let i = 1; i < states.length; i++) {
    const state = states[i]!;
    if (state.cooldownUntil < bestState.cooldownUntil) {
      bestState = state;
      bestIdx = i;
    }
  }
  return bestIdx;
}
