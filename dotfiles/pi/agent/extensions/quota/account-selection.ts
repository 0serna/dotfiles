import { isObservationUsable } from "./snapshot-transitions.js";
import type { QuotaSnapshot, SourceIdentity } from "./snapshot.js";
import type { AccountConfig, AccountState } from "./types.js";

const PROVIDER_ID = "opencode-go";
export const DEFAULT_COOLDOWN_MS = 60_000;

export type AccountSelectionFact =
  | { type: "startup"; snapshot: QuotaSnapshot; now: number }
  | { type: "snapshot-revision"; snapshot: QuotaSnapshot }
  | { type: "provider-exhausted"; now: number }
  | { type: "turn-start" }
  | { type: "processing-settled"; idle: boolean; now: number }
  | { type: "shutdown" };

export type AccountSelectionOutcome =
  | {
      type: "activate-account";
      accountName: string;
      apiKey: string;
      source: SourceIdentity;
    }
  | { type: "clear-account" }
  | { type: "request-continuation"; reason: "quota-rotation" }
  | { type: "notify"; level: "info" | "warning"; message: string }
  | { type: "log"; event: string; data?: Record<string, unknown> };

export type AccountSelectionOptions = {
  accounts: ReadonlyArray<AccountConfig>;
  env?: NodeJS.ProcessEnv;
  cooldownMs?: number;
};

export type AccountSelection = {
  handle(fact: AccountSelectionFact): AccountSelectionOutcome[];
  activeAccountName(): string | undefined;
  activeSource(): SourceIdentity | undefined;
};

function initializeAccounts(
  accounts: ReadonlyArray<AccountConfig>,
  env: NodeJS.ProcessEnv,
): AccountState[] {
  return accounts.flatMap((account) => {
    const apiKey = env[account.apiKeyEnv]?.trim();
    return apiKey
      ? [
          {
            name: account.name,
            apiKey,
            lastStatus: "untried" as const,
            cooldownUntil: 0,
            failures: 0,
          },
        ]
      : [];
  });
}

function sourceFor(accountName: string): SourceIdentity {
  return { providerId: PROVIDER_ID, sourceId: `${PROVIDER_ID}:${accountName}` };
}

const SENTINEL_DAYS_THRESHOLD = 1 / 24; // 1 hour

/**
 * Compute urgency as [isSentinel, sortValue] where higher sortValue wins.
 * - Normal:  [0, urgencyRate] where urgencyRate = remainingPercent / daysUntilReset
 * - Sentinel: [1, -actualDaysUntilReset] so smaller daysUntilReset sorts higher
 *
 * Returns undefined when the account is ineligible (any window <= 0%, incomplete windows).
 */
function urgencyScore(
  record: NonNullable<QuotaSnapshot["sources"][string]>,
  now: number,
): [number, number] | undefined {
  const { monthly, weekly, rolling } = record.windows ?? {};
  // Eligibility guards: all three windows must exist and be above zero
  if (!monthly || !weekly || !rolling) return undefined;
  if (
    monthly.remainingPercent <= 0 ||
    weekly.remainingPercent <= 0 ||
    rolling.remainingPercent <= 0
  ) {
    return undefined;
  }

  const monthlyWindow = record.windows?.monthly;
  if (!monthlyWindow) return undefined;

  const nowSec = now / 1000;
  const daysUntilReset = (monthlyWindow.resetAt - nowSec) / 86400;

  if (daysUntilReset < SENTINEL_DAYS_THRESHOLD) {
    // Sentinel: max urgency, tiebreak by actual remaining time (smaller = higher)
    return [1, -daysUntilReset];
  }

  return [0, monthlyWindow.remainingPercent / daysUntilReset];
}

function compareUrgency(
  left: [number, number],
  right: [number, number],
): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  return left[1] - right[1];
}

export function createAccountSelection(
  options: AccountSelectionOptions,
): AccountSelection {
  const states = initializeAccounts(
    options.accounts,
    options.env ?? process.env,
  );
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  let activeIndex = -1;
  let latestSnapshot: QuotaSnapshot | undefined;
  let continuationRequested = false;
  const attemptedAccounts = new Set<string>();
  let stopped = false;

  const active = () => states[activeIndex];
  const activeSource = () => {
    const account = active();
    return account ? sourceFor(account.name) : undefined;
  };

  const activation = (index: number): AccountSelectionOutcome[] => {
    const account = states[index];
    if (!account) return [];
    activeIndex = index;
    return [
      {
        type: "activate-account",
        accountName: account.name,
        apiKey: account.apiKey,
        source: sourceFor(account.name),
      },
      {
        type: "log",
        event: "account_activated",
        data: { provider: PROVIDER_ID, account: account.name, index },
      },
    ];
  };

  const selectFromSnapshot = (
    snapshot: QuotaSnapshot | undefined,
    now: number,
    excludedAccounts: ReadonlySet<string> = new Set(),
  ): number => {
    if (!snapshot) return -1;
    let bestIndex = -1;
    let bestUrgency: [number, number] | undefined;
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      if (state.cooldownUntil > now || excludedAccounts.has(state.name)) {
        continue;
      }
      const record =
        snapshot.sources[`${PROVIDER_ID}/${PROVIDER_ID}:${state.name}`];
      if (!record || !isObservationUsable(record)) continue;
      const candidateUrgency = urgencyScore(record, now);
      if (!candidateUrgency) continue;
      if (!bestUrgency || compareUrgency(candidateUrgency, bestUrgency) > 0) {
        bestIndex = i;
        bestUrgency = candidateUrgency;
      }
    }
    return bestIndex;
  };

  return {
    handle(fact) {
      if (stopped && fact.type !== "shutdown") return [];
      switch (fact.type) {
        case "startup": {
          latestSnapshot = fact.snapshot;
          return activation(selectFromSnapshot(fact.snapshot, fact.now));
        }
        case "snapshot-revision":
          latestSnapshot = fact.snapshot;
          return [];
        case "provider-exhausted": {
          const current = active();
          if (!current) {
            return [
              {
                type: "log",
                event: "rotation_skipped",
                data: { provider: PROVIDER_ID, reason: "no_active_account" },
              },
              {
                type: "notify",
                level: "warning",
                message:
                  "OpenCode Go rejected the request, but no quota account is active to rotate.",
              },
            ];
          }
          if (continuationRequested) return [];

          current.lastStatus = "rate-limited";
          current.cooldownUntil = fact.now + cooldownMs;
          current.failures += 1;
          attemptedAccounts.add(current.name);

          const nextIndex = selectFromSnapshot(
            latestSnapshot,
            fact.now,
            attemptedAccounts,
          );
          if (nextIndex < 0) {
            return [
              {
                type: "log",
                event: "rotation_unavailable",
                data: {
                  provider: PROVIDER_ID,
                  triedAccounts: [...attemptedAccounts],
                },
              },
              {
                type: "notify",
                level: "warning",
                message:
                  "No eligible OpenCode Go account is available for rotation.",
              },
            ];
          }

          const previousName = current.name;
          const outcomes = activation(nextIndex);
          outcomes.push(
            {
              type: "log",
              event: "rotate_success",
              data: {
                provider: PROVIDER_ID,
                fromAccount: previousName,
                toAccount: active()?.name,
                reason: "rate-limited",
              },
            },
            {
              type: "notify",
              level: "info",
              message: `Rotated OpenCode Go: ${previousName} → ${active()!.name}`,
            },
            { type: "request-continuation", reason: "quota-rotation" },
          );
          continuationRequested = true;
          return outcomes;
        }
        case "turn-start":
          continuationRequested = false;
          return [];
        case "processing-settled":
          if (fact.idle) attemptedAccounts.clear();
          return [];
        case "shutdown":
          stopped = true;
          attemptedAccounts.clear();
          latestSnapshot = undefined;
          return [{ type: "clear-account" }];
      }
    },
    activeAccountName: () => active()?.name,
    activeSource,
  };
}
