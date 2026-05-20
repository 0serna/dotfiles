import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "./shared/logger.js";

const CONTEXT_USAGE_WARNING_TOKENS = 100_000;
const CACHE_HIT_WARNING_PERCENT = 80;

function formatK(value: number): string {
  if (value < 1000) {
    return value.toFixed(1);
  }

  return `${(value / 1000).toFixed(1)}k`;
}

function formatPercent(value: number): string {
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

let logger: ExtensionLogger;

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

function computeHitRate(usage: { input: number; cacheRead: number }): number {
  const denominator = usage.input + usage.cacheRead;
  if (denominator === 0) return 0;
  return Math.round((usage.cacheRead / denominator) * 100);
}

function formatCacheHit(entries: CacheUsageEntry[]): {
  text: string;
  percent: number;
  cacheUnavailableReason?: string;
} {
  const usages = entries
    .filter(isAssistantWithUsage)
    .map((e) => e.message.usage);
  const latestUsage = usages.at(-1);

  if (!latestUsage) {
    return {
      text: "cache 0%",
      percent: 0,
      cacheUnavailableReason: "no_assistant_messages",
    };
  }

  const allCacheReadZero = usages.every((u) => u.cacheRead === 0);

  if (allCacheReadZero) {
    return {
      text: "cache 0%",
      percent: 0,
      cacheUnavailableReason: "no_cache_reads",
    };
  }

  const percent = computeHitRate(latestUsage);

  if (latestUsage.input + latestUsage.cacheRead === 0) {
    return {
      text: "cache 0%",
      percent: 0,
      cacheUnavailableReason: "zero_denominator",
    };
  }

  return {
    text: `cache ${formatPercent(percent)}`,
    percent,
  };
}

function isContextOverLimit(usage: ContextUsage | undefined): boolean {
  return (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS;
}

function logCacheStatus(cacheInfo: {
  cacheUnavailableReason?: string;
  percent: number;
}): void {
  if (cacheInfo.cacheUnavailableReason) {
    logger.log("cache_unavailable", {
      reason: cacheInfo.cacheUnavailableReason,
    });
    return;
  }

  if (cacheInfo.percent < CACHE_HIT_WARNING_PERCENT) {
    logger.log("cache_below_threshold", {
      hitRate: cacheInfo.percent,
      threshold: CACHE_HIT_WARNING_PERCENT,
    });
  }
}

function publishStatus(
  ctx: ExtensionContext,
  shouldLog: boolean = false,
): void {
  const usage = ctx.getContextUsage();
  const entries = ctx.sessionManager.getBranch() as CacheUsageEntry[];
  const cacheInfo = formatCacheHit(entries);

  if (shouldLog) {
    logCacheStatus(cacheInfo);
  }

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
  const styledContext = isContextOverLimit(usage)
    ? ctx.ui.theme.fg("mdHeading", contextText)
    : ctx.ui.theme.fg("dim", contextText);
  const styledCache =
    cacheInfo.percent < CACHE_HIT_WARNING_PERCENT
      ? ctx.ui.theme.fg("mdHeading", cacheInfo.text)
      : ctx.ui.theme.fg("dim", cacheInfo.text);

  ctx.ui.setStatus(
    "context-usage",
    `${styledContext}${ctx.ui.theme.fg("dim", " ")}${styledCache}`,
  );
}

function computeAndPublishStatus(
  ctx: ExtensionContext,
  shouldLog: boolean = false,
): void {
  try {
    publishStatus(ctx, shouldLog);
  } catch (error) {
    logger.log("status_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "context-usage");
    computeAndPublishStatus(ctx);
  });

  pi.on("turn_end", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });

  pi.on("agent_end", (_event, ctx) => {
    computeAndPublishStatus(ctx, true);
  });
}
