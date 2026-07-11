export const CACHE_HIT_WARNING_PERCENT = 80;

export type ContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

export type CacheUsageEntry = {
  type: string;
  message?: {
    role?: string;
    model?: string;
    provider?: string;
    timestamp?: number;
    usage?: {
      input: number;
      cacheRead: number;
      cacheWrite?: number;
      cost?: {
        input: number;
        output?: number;
        cacheRead: number;
        cacheWrite?: number;
        total?: number;
      };
    };
  };
};

export type CacheInfo = {
  text: string;
  percent: number;
  input: number;
  cacheRead: number;
  belowThresholdStreak: number;
  cacheUnavailableReason?: string;
  /** Estimated USD from cache misses; 0 when unknown. */
  missedCost: number;
  modelSwitched: boolean;
  /** Model key as "provider/model". */
  previousModel?: string;
  /** Milliseconds since the previous assistant message; 0 on first turn. */
  idleMs: number;
};

export function formatK(value: number): string {
  return `${Math.round(value / 1000)}k`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCurrentUsage(usage: ContextUsage | undefined): string {
  if (usage == null || usage.tokens == null) {
    return formatK(0);
  }

  return formatK(usage.tokens);
}

type AssistantEntry = CacheUsageEntry & {
  message: {
    role: "assistant";
    model?: string;
    provider?: string;
    timestamp?: number;
    usage: {
      input: number;
      cacheRead: number;
      cacheWrite?: number;
      cost?: {
        input: number;
        output?: number;
        cacheRead: number;
        cacheWrite?: number;
        total?: number;
      };
    };
  };
};

function isAssistantWithUsage(entry: CacheUsageEntry): entry is AssistantEntry {
  return (
    entry.type === "message" &&
    entry.message?.role === "assistant" &&
    !!entry.message.usage
  );
}

function modelKey(entry: AssistantEntry): string | undefined {
  const provider = entry.message.provider;
  const model = entry.message.model;
  if (!provider || !model) return undefined;
  return `${provider}/${model}`;
}

function perTokenCost(cost: number | undefined, tokens: number): number {
  if (!cost || tokens <= 0) return 0;
  return cost / tokens;
}

function computeIdleMs(
  latest: AssistantEntry | undefined,
  previous: AssistantEntry | undefined,
): number {
  if (!latest || !previous) return 0;
  const now = latest.message.timestamp;
  const prev = previous.message.timestamp;
  if (now === undefined || prev === undefined) return 0;
  return Math.max(0, now - prev);
}

/**
 * Estimate extra cost from a cache miss: tokens that could have been cache
 * reads but were billed at the higher input rate instead.
 */
function estimateMissedCost(
  current: AssistantEntry,
  previous: AssistantEntry,
): number {
  const prevUsage = previous.message.usage;
  const currUsage = current.message.usage;

  const prevPromptTokens =
    prevUsage.input + prevUsage.cacheRead + (prevUsage.cacheWrite ?? 0);
  const currPromptTokens =
    currUsage.input + currUsage.cacheRead + (currUsage.cacheWrite ?? 0);

  const missedTokens =
    Math.min(prevPromptTokens, currPromptTokens) - currUsage.cacheRead;
  if (missedTokens <= 0) return 0;

  // Paid rate: what we paid for non-cached tokens in this message
  const paidTokens = currUsage.input + (currUsage.cacheWrite ?? 0);
  const paidCost =
    (currUsage.cost?.input ?? 0) + (currUsage.cost?.cacheWrite ?? 0);
  const paidPerToken = paidTokens > 0 ? paidCost / paidTokens : 0;

  // Cache-read rate: what we would have paid if these tokens were cached
  const readPerToken = perTokenCost(
    currUsage.cost?.cacheRead,
    currUsage.cacheRead,
  );

  return missedTokens * Math.max(0, paidPerToken - readPerToken);
}

function computeHitRate(usage: { input: number; cacheRead: number }): number {
  const denominator = usage.input + usage.cacheRead;
  if (denominator === 0) return 0;
  return Math.round((usage.cacheRead / denominator) * 100);
}

function countBelowThresholdStreak(
  usages: Array<{ input: number; cacheRead: number }>,
): number {
  let streak = 0;

  for (let index = usages.length - 1; index >= 0; index -= 1) {
    const usage = usages[index];
    if (usage === undefined) continue;
    if (computeHitRate(usage) >= CACHE_HIT_WARNING_PERCENT) break;
    streak += 1;
  }

  return streak;
}

export function formatCacheHit(entries: CacheUsageEntry[]): CacheInfo {
  const assistants = entries.filter(isAssistantWithUsage);
  const usages = assistants.map((e) => e.message.usage);
  const latest = assistants.at(-1);
  const previous = assistants.at(-2);
  const latestUsage = usages.at(-1);
  const belowThresholdStreak = countBelowThresholdStreak(usages);

  const prevKey = previous ? modelKey(previous) : undefined;
  const currKey = latest ? modelKey(latest) : undefined;

  const base = {
    missedCost: latest && previous ? estimateMissedCost(latest, previous) : 0,
    modelSwitched:
      currKey !== undefined && prevKey !== undefined && currKey !== prevKey,
    previousModel: prevKey,
    idleMs: computeIdleMs(latest, previous),
  };

  const unavailable = (
    reason: string,
    input: number,
    cacheRead: number,
  ): CacheInfo => ({
    ...base,
    text: "◉ 0%",
    percent: 0,
    input,
    cacheRead,
    belowThresholdStreak,
    cacheUnavailableReason: reason,
  });

  if (!latestUsage) {
    return unavailable("no_assistant_messages", 0, 0);
  }

  const allCacheReadZero = usages.every((u) => u.cacheRead === 0);

  if (allCacheReadZero) {
    return unavailable(
      "no_cache_reads",
      latestUsage.input,
      latestUsage.cacheRead,
    );
  }

  const percent = computeHitRate(latestUsage);

  if (latestUsage.input + latestUsage.cacheRead === 0) {
    return unavailable(
      "zero_denominator",
      latestUsage.input,
      latestUsage.cacheRead,
    );
  }

  return {
    ...base,
    text: `◉ ${formatPercent(percent)}`,
    percent,
    input: latestUsage.input,
    cacheRead: latestUsage.cacheRead,
    belowThresholdStreak,
  };
}

export function isCacheBelowThreshold(cacheInfo: CacheInfo): boolean {
  return cacheInfo.belowThresholdStreak > 3;
}
