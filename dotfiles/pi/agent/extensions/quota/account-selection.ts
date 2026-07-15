import { isObservationUsable } from "./snapshot-transitions.js";
import type {
  QuotaSnapshot,
  SourceExhaustion,
  SourceIdentity,
} from "./snapshot.js";
import type { AccountConfig, AccountState } from "./types.js";

const PROVIDER_ID = "opencode-go";
export const DEFAULT_COOLDOWN_MS = 60_000;

export type AccountSelectionFact =
  | { type: "startup"; snapshot: QuotaSnapshot; now: number }
  | {
      type: "snapshot-revision";
      snapshot: QuotaSnapshot;
      idle: boolean;
      now: number;
    }
  | { type: "provider-exhausted"; now: number; reportedBy: string }
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
  | {
      type: "record-exhaustion";
      source: SourceIdentity;
      exhaustion: SourceExhaustion;
    }
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

function score(
  record: NonNullable<QuotaSnapshot["sources"][string]>,
): number[] | undefined {
  const { monthly, weekly, rolling } = record.windows ?? {};
  if (!monthly || !weekly || !rolling) return undefined;
  if (
    monthly.remainingPercent <= 0 ||
    weekly.remainingPercent <= 0 ||
    rolling.remainingPercent <= 0
  ) {
    return undefined;
  }
  return [
    Math.min(
      monthly.remainingPercent,
      weekly.remainingPercent,
      rolling.remainingPercent,
    ),
    monthly.remainingPercent,
    weekly.remainingPercent,
    rolling.remainingPercent,
  ];
}

function compareScore(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return 0;
}

export function createAccountSelection(
  options: AccountSelectionOptions,
): AccountSelection {
  const configuredAccounts = options.accounts;
  const states = initializeAccounts(
    configuredAccounts,
    options.env ?? process.env,
  );
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  let activeIndex = -1;
  let latestSnapshot: QuotaSnapshot | undefined;
  let blindFallback = false;
  let pendingReselection = false;
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

  const selectFromSnapshot = (snapshot: QuotaSnapshot, now: number): number => {
    let bestIndex = -1;
    let bestScore: number[] | undefined;
    for (const account of configuredAccounts) {
      const stateIndex = states.findIndex(
        (state) => state.name === account.name,
      );
      const state = states[stateIndex];
      if (!state || state.cooldownUntil > now) continue;
      const record =
        snapshot.sources[`${PROVIDER_ID}/${PROVIDER_ID}:${account.name}`];
      if (!record || !isObservationUsable(record)) continue;
      const candidateScore = score(record);
      if (!candidateScore) continue;
      if (!bestScore || compareScore(candidateScore, bestScore) > 0) {
        bestIndex = stateIndex;
        bestScore = candidateScore;
      }
    }
    return bestIndex;
  };

  const reselect = (now: number): AccountSelectionOutcome[] => {
    if (!latestSnapshot) return [];
    const selected = selectFromSnapshot(latestSnapshot, now);
    if (selected < 0) return [];
    blindFallback = false;
    pendingReselection = false;
    if (selected === activeIndex) return [];
    return [
      ...activation(selected),
      {
        type: "log",
        event: "preventive_reselection",
        data: { provider: PROVIDER_ID, account: active()?.name },
      },
    ];
  };

  const needsReselection = (): boolean => {
    if (blindFallback) return true;
    const source = activeSource();
    if (!source || !latestSnapshot) return false;
    const record =
      latestSnapshot.sources[`${source.providerId}/${source.sourceId}`];
    return !record || !isObservationUsable(record);
  };

  return {
    handle(fact) {
      if (stopped && fact.type !== "shutdown") return [];
      switch (fact.type) {
        case "startup": {
          latestSnapshot = fact.snapshot;
          const selected = selectFromSnapshot(fact.snapshot, fact.now);
          const chosen = selected >= 0 ? selected : states.length > 0 ? 0 : -1;
          blindFallback = selected < 0 && chosen >= 0;
          const outcomes = activation(chosen);
          if (blindFallback) {
            outcomes.push({
              type: "log",
              event: "session_start_blind_fallback",
              data: {
                provider: PROVIDER_ID,
                reason:
                  "no usable snapshot observation, activating first account",
              },
            });
          }
          return outcomes;
        }
        case "snapshot-revision":
          latestSnapshot = fact.snapshot;
          if (activeIndex < 0 || !needsReselection()) return [];
          if (!fact.idle) {
            pendingReselection = true;
            return [];
          }
          return reselect(fact.now);
        case "provider-exhausted": {
          const current = active();
          if (!current) return [];
          const outcomes: AccountSelectionOutcome[] = [
            {
              type: "record-exhaustion",
              source: sourceFor(current.name),
              exhaustion: {
                confirmedAt: fact.now,
                reportedBy: fact.reportedBy,
              },
            },
          ];
          attemptedAccounts.add(current.name);
          if (states.every((state) => attemptedAccounts.has(state.name))) {
            outcomes.push(
              {
                type: "log",
                event: "rotate_cycle_exhausted",
                data: {
                  provider: PROVIDER_ID,
                  triedAccounts: [...attemptedAccounts],
                  accountCount: states.length,
                },
              },
              {
                type: "notify",
                level: "warning",
                message:
                  "All OpenCode Go accounts have been attempted during this processing cycle. Quota may be exhausted on every account.",
              },
            );
            return outcomes;
          }
          if (continuationRequested) return outcomes;
          current.lastStatus = "rate-limited";
          current.cooldownUntil = fact.now + cooldownMs;
          current.failures += 1;
          let nextIndex = -1;
          for (let offset = 1; offset <= states.length; offset += 1) {
            const candidate = (activeIndex + offset) % states.length;
            if (states[candidate]!.cooldownUntil <= fact.now) {
              nextIndex = candidate;
              break;
            }
          }
          if (nextIndex < 0 || nextIndex === activeIndex) {
            outcomes.push(
              {
                type: "log",
                event: "rotate_exhausted",
                data: { provider: PROVIDER_ID, accountCount: states.length },
              },
              {
                type: "notify",
                level: "warning",
                message:
                  "All OpenCode Go accounts are exhausted or on cooldown.",
              },
            );
            return outcomes;
          }
          const previousName = current.name;
          outcomes.push(...activation(nextIndex));
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
          if (!fact.idle) return [];
          attemptedAccounts.clear();
          if (pendingReselection && needsReselection())
            return reselect(fact.now);
          pendingReselection = false;
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
