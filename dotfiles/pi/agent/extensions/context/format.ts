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
  cacheUnavailableReason?: string;
};

export function formatK(value: number): string {
  if (value < 1000) {
    return value.toFixed(1);
  }

  return `${(value / 1000).toFixed(1)}k`;
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

export function formatCacheHit(entries: CacheUsageEntry[]): CacheInfo {
  const usages = entries
    .filter(isAssistantWithUsage)
    .map((e) => e.message.usage);
  const latestUsage = usages.at(-1);

  if (!latestUsage) {
    return {
      text: "cache 0%",
      percent: 0,
      input: 0,
      cacheRead: 0,
      cacheUnavailableReason: "no_assistant_messages",
    };
  }

  const allCacheReadZero = usages.every((u) => u.cacheRead === 0);

  if (allCacheReadZero) {
    return {
      text: "cache 0%",
      percent: 0,
      input: latestUsage.input,
      cacheRead: latestUsage.cacheRead,
      cacheUnavailableReason: "no_cache_reads",
    };
  }

  const percent = computeHitRate(latestUsage);

  if (latestUsage.input + latestUsage.cacheRead === 0) {
    return {
      text: "cache 0%",
      percent: 0,
      input: latestUsage.input,
      cacheRead: latestUsage.cacheRead,
      cacheUnavailableReason: "zero_denominator",
    };
  }

  return {
    text: `cache ${formatPercent(percent)}`,
    percent,
    input: latestUsage.input,
    cacheRead: latestUsage.cacheRead,
  };
}

export function isCacheBelowThreshold(cacheInfo: CacheInfo): boolean {
  return cacheInfo.percent < CACHE_HIT_WARNING_PERCENT;
}
