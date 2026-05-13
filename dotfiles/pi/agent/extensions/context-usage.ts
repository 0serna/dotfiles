import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CONTEXT_USAGE_WARNING_TOKENS = 150_000;
const CACHE_HIT_WARNING_PERCENT = 60;

function formatK(value: number): string {
  if (value < 1000) {
    return `${value}`;
  }

  return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
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

function formatCacheHit(entries: CacheUsageEntry[]): {
  text: string;
  percent: number | null;
} {
  let input = 0;
  let cacheRead = 0;

  for (const entry of entries) {
    if (!isAssistantWithUsage(entry)) continue;

    input += entry.message.usage.input;
    cacheRead += entry.message.usage.cacheRead;
  }

  const denominator = input + cacheRead;
  if (denominator === 0) {
    return { text: "kv 0%", percent: null };
  }

  const percent = (cacheRead / denominator) * 100;
  return { text: `kv ${formatPercent(percent)}`, percent };
}

function styleCacheSegment(
  cacheInfo: { text: string; percent: number | null },
  ctx: ExtensionContext,
): string {
  if (
    cacheInfo.percent != null &&
    cacheInfo.percent < CACHE_HIT_WARNING_PERCENT
  ) {
    return ctx.ui.theme.fg("mdHeading", cacheInfo.text);
  }
  return ctx.ui.theme.fg("dim", cacheInfo.text);
}

function computeAndPublishStatus(ctx: ExtensionContext): void {
  const usage = ctx.getContextUsage();
  const cacheInfo = formatCacheHit(
    ctx.sessionManager.getBranch() as CacheUsageEntry[],
  );

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
  const styledContext =
    (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS
      ? ctx.ui.theme.fg("mdHeading", contextText)
      : ctx.ui.theme.fg("dim", contextText);

  const status = `${styledContext}${ctx.ui.theme.fg("dim", " · ")}${styleCacheSegment(cacheInfo, ctx)}`;
  ctx.ui.setStatus("context-usage", status);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });

  pi.on("turn_end", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    computeAndPublishStatus(ctx);
  });
}
