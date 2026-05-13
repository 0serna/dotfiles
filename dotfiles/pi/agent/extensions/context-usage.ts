import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CONTEXT_USAGE_WARNING_TOKENS = 150_000;

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

function formatCacheHit(entries: CacheUsageEntry[]): string {
  let input = 0;
  let cacheRead = 0;

  for (const entry of entries) {
    if (!isAssistantWithUsage(entry)) continue;

    input += entry.message.usage.input;
    cacheRead += entry.message.usage.cacheRead;
  }

  const denominator = input + cacheRead;
  if (denominator === 0) {
    return "kv ?%";
  }

  return `kv ${formatPercent((cacheRead / denominator) * 100)}`;
}

function computeAndPublishStatus(ctx: ExtensionContext): void {
  const usage = ctx.getContextUsage();
  const cacheText = formatCacheHit(
    ctx.sessionManager.getBranch() as CacheUsageEntry[],
  );

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
  const styledContext =
    (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS
      ? ctx.ui.theme.fg("mdHeading", contextText)
      : ctx.ui.theme.fg("dim", contextText);

  const status = `${styledContext}${ctx.ui.theme.fg("dim", " · ")}${ctx.ui.theme.fg("dim", cacheText)}`;
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
