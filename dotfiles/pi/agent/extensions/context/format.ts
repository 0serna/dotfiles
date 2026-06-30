export const CACHE_HIT_WARNING_PERCENT = 80;

export type ContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

export type DcpStatusMetrics = {
  contextSequence?: number;
  stubbedCount: number;
  estimatedSavedTokens: number;
  reasonCounts: Record<string, number>;
};

export function emptyDcpMetrics(): DcpStatusMetrics {
  return {
    contextSequence: undefined,
    stubbedCount: 0,
    estimatedSavedTokens: 0,
    reasonCounts: {},
  };
}

export type CacheUsageEntry = {
  type: string;
  message?: {
    role?: string;
    usage?: {
      input: number;
      cacheRead: number;
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

function isAssistantWithUsage(
  entry: CacheUsageEntry,
): entry is CacheUsageEntry & {
  message: { usage: { input: number; cacheRead: number } };
} {
  return (
    entry.type === "message" &&
    entry.message?.role === "assistant" &&
    !!entry.message.usage
  );
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
  const usages = entries
    .filter(isAssistantWithUsage)
    .map((e) => e.message.usage);
  const latestUsage = usages.at(-1);
  const belowThresholdStreak = countBelowThresholdStreak(usages);

  if (!latestUsage) {
    return {
      text: "◉ 0%",
      percent: 0,
      input: 0,
      cacheRead: 0,
      belowThresholdStreak,
      cacheUnavailableReason: "no_assistant_messages",
    };
  }

  const allCacheReadZero = usages.every((u) => u.cacheRead === 0);

  if (allCacheReadZero) {
    return {
      text: "◉ 0%",
      percent: 0,
      input: latestUsage.input,
      cacheRead: latestUsage.cacheRead,
      belowThresholdStreak,
      cacheUnavailableReason: "no_cache_reads",
    };
  }

  const percent = computeHitRate(latestUsage);

  if (latestUsage.input + latestUsage.cacheRead === 0) {
    return {
      text: "◉ 0%",
      percent: 0,
      input: latestUsage.input,
      cacheRead: latestUsage.cacheRead,
      belowThresholdStreak,
      cacheUnavailableReason: "zero_denominator",
    };
  }

  return {
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
