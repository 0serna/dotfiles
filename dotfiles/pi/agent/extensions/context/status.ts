import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import {
  CACHE_HIT_WARNING_PERCENT,
  formatCacheHit,
  formatCurrentUsage,
  isCacheBelowThreshold,
  type CacheInfo,
  type CacheUsageEntry,
  type ContextUsage,
} from "./format.js";

const CONTEXT_USAGE_WARNING_TOKENS = 125_000;
const STATUS_KEY = "context";

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

function isContextOverLimit(usage: ContextUsage | undefined): boolean {
  return (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS;
}

function logCacheStatus(logger: ExtensionLogger, cacheInfo: CacheInfo): void {
  if (cacheInfo.cacheUnavailableReason) {
    logger.log("cache_unavailable", {
      reason: cacheInfo.cacheUnavailableReason,
    });
    return;
  }

  if (isCacheBelowThreshold(cacheInfo)) {
    logger.log("cache_below_threshold", {
      hitRate: cacheInfo.percent,
      threshold: CACHE_HIT_WARNING_PERCENT,
    });
  }
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
    logCacheStatus(logger, cacheInfo);
  }

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
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
