import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import {
  formatCacheHit,
  formatCurrentUsage,
  isCacheBelowThreshold,
  type CacheInfo,
  type CacheUsageEntry,
  type ContextUsage,
} from "./format.js";

const CONTEXT_USAGE_WARNING_TOKENS = 120_000;
const STATUS_KEY = "context";

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

function isContextOverLimit(usage: ContextUsage | undefined): boolean {
  return (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS;
}

function logCacheStatus(
  logger: ExtensionLogger,
  cacheInfo: CacheInfo,
  usage: ContextUsage | undefined,
): void {
  logger.log("cache_status", {
    hitRate: cacheInfo.percent,
    input: cacheInfo.input,
    cacheRead: cacheInfo.cacheRead,
    reason: cacheInfo.cacheUnavailableReason ?? null,
    contextTokens: usage?.tokens ?? null,
    contextWindow: usage?.contextWindow ?? null,
    missedCost: cacheInfo.missedCost,
    modelSwitched: cacheInfo.modelSwitched,
    previousModel: cacheInfo.previousModel ?? null,
    idleMs: cacheInfo.idleMs,
    belowThresholdStreak: cacheInfo.belowThresholdStreak,
  });
}

function publishStatus(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
  shouldLog: boolean = false,
): void {
  const usage = ctx.getContextUsage();
  const entries = ctx.sessionManager.getBranch() as CacheUsageEntry[];
  const cacheInfo = formatCacheHit(entries);

  if (shouldLog) {
    logCacheStatus(logger, cacheInfo, usage);
  }

  const contextText = `Σ ${formatCurrentUsage(usage)}`;
  const styledContext = isContextOverLimit(usage)
    ? ctx.ui.theme.fg("warning", contextText)
    : ctx.ui.theme.fg("dim", contextText);
  const styledCache = isCacheBelowThreshold(cacheInfo)
    ? ctx.ui.theme.fg("warning", cacheInfo.text)
    : ctx.ui.theme.fg("dim", cacheInfo.text);

  ctx.ui.setStatus(
    STATUS_KEY,
    `${styledContext}${ctx.ui.theme.fg("dim", " ")}${styledCache}`,
  );
}

export function computeAndPublishStatus(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
  shouldLog: boolean = false,
): void {
  try {
    publishStatus(ctx, logger, shouldLog);
  } catch (error) {
    logger.log("status_error", failureDetails(error));
  }
}
