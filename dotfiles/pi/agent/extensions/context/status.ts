import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import {
  formatCacheHit,
  formatCurrentUsage,
  type CacheInfo,
  type CacheUsageEntry,
  type ContextUsage,
} from "./format.js";

const CONTEXT_USAGE_WARNING_TOKENS = 150_000;
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
  shouldLog: boolean,
): void {
  const usage = ctx.getContextUsage();

  if (shouldLog) {
    const entries = ctx.sessionManager.getBranch() as CacheUsageEntry[];
    const cacheInfo = formatCacheHit(entries);
    logCacheStatus(logger, cacheInfo, usage);
  }

  const contextText = formatCurrentUsage(usage);
  const styledContext = isContextOverLimit(usage)
    ? ctx.ui.theme.fg("warning", contextText)
    : ctx.ui.theme.fg("dim", contextText);

  ctx.ui.setStatus(STATUS_KEY, styledContext);
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
