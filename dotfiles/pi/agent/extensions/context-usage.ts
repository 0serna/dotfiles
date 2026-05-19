import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { log } from "./shared/logger.js";

const CONTEXT_USAGE_WARNING_TOKENS = 100_000;
const CACHE_HIT_REGRESSION_PP = 25;

function formatK(value: number): string {
  if (value < 1000) {
    return value.toFixed(1);
  }

  return `${(value / 1000).toFixed(1)}k`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) {
    return "?%";
  }

  return `${Math.round(value)}%`;
}

type ContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

type CacheUsageEntry = {
  type: string;
  message?: {
    role?: string;
    usage?: {
      input: number;
      cacheRead: number;
    };
  };
};

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

function formatCurrentUsage(usage: ContextUsage | undefined): string {
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

function computeHitRate(usage: {
  input: number;
  cacheRead: number;
}): number | null {
  const denominator = usage.input + usage.cacheRead;
  if (denominator === 0) return null;
  return Math.round((usage.cacheRead / denominator) * 100);
}

function findLastTwoAssistantUsages(
  entries: CacheUsageEntry[],
): [
  latest: { input: number; cacheRead: number } | undefined,
  previous: { input: number; cacheRead: number } | undefined,
] {
  const usages = entries
    .filter(isAssistantWithUsage)
    .map((e) => e.message.usage);
  return [usages.at(-1), usages.at(-2)];
}

function computeTrend(
  percent: number | null,
  previousPercent: number | null,
): string {
  if (percent == null || previousPercent == null) return "";
  return ["↓", "", "↑"][Math.sign(percent - previousPercent) + 1];
}

function isCacheSupported(entries: CacheUsageEntry[]): boolean {
  return entries
    .filter(isAssistantWithUsage)
    .some((e) => e.message.usage.cacheRead > 0);
}

function hasNoCacheData(entries: CacheUsageEntry[]): boolean {
  return entries.filter(isAssistantWithUsage).length === 0;
}

function computeCacheRates(
  entries: CacheUsageEntry[],
): [percent: number | null, previousPercent: number | null] {
  const [latestUsage, previousUsage] = findLastTwoAssistantUsages(entries);
  const percent = latestUsage ? computeHitRate(latestUsage) : null;
  const previousPercent = previousUsage ? computeHitRate(previousUsage) : null;
  return [percent, previousPercent];
}

function formatCacheHit(entries: CacheUsageEntry[]): {
  text: string;
  percent: number | null;
  previousPercent: number | null;
} {
  if (hasNoCacheData(entries)) {
    return { text: "cache 0%", percent: null, previousPercent: null };
  }

  if (!isCacheSupported(entries)) {
    return { text: "cache —", percent: null, previousPercent: null };
  }

  const [percent, previousPercent] = computeCacheRates(entries);

  return {
    text: `cache ${formatPercent(percent)}${computeTrend(percent, previousPercent)}`,
    percent,
    previousPercent,
  };
}

function isRegression(
  percent: number | null,
  previousPercent: number | null,
): boolean {
  return (
    percent != null &&
    previousPercent != null &&
    previousPercent - percent >= CACHE_HIT_REGRESSION_PP
  );
}

function isContextOverLimit(usage: ContextUsage | undefined): boolean {
  return (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS;
}

function publishStatus(ctx: ExtensionContext): void {
  const usage = ctx.getContextUsage();
  const entries = ctx.sessionManager.getBranch() as CacheUsageEntry[];
  const cacheInfo = formatCacheHit(entries);

  const regression = isRegression(cacheInfo.percent, cacheInfo.previousPercent);

  if (regression) {
    log("context-usage", "regression_detected", {
      previousHitRate: cacheInfo.previousPercent,
      currentHitRate: cacheInfo.percent,
      drop: cacheInfo.previousPercent - cacheInfo.percent,
    });
  }

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
  const styledContext = isContextOverLimit(usage)
    ? ctx.ui.theme.fg("mdHeading", contextText)
    : ctx.ui.theme.fg("dim", contextText);
  const styledCache = regression
    ? ctx.ui.theme.fg("mdHeading", cacheInfo.text)
    : ctx.ui.theme.fg("dim", cacheInfo.text);

  ctx.ui.setStatus(
    "context-usage",
    `${styledContext}${ctx.ui.theme.fg("dim", " · ")}${styledCache}`,
  );
}

function computeAndPublishStatus(ctx: ExtensionContext): void {
  try {
    publishStatus(ctx);
  } catch (error) {
    log("context-usage", "status_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    log("context-usage", "extension_loaded", { cwd: ctx.cwd });
    computeAndPublishStatus(ctx);
  });

  pi.on("turn_end", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });
}
