import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import {
  emptyDcpMetrics,
  formatCacheHit,
  formatCurrentUsage,
  formatK,
  isCacheBelowThreshold,
  type CacheInfo,
  type CacheUsageEntry,
  type ContextUsage,
  type DcpStatusMetrics,
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
  lastDcp: DcpStatusMetrics,
): void {
  logger.log("cache_status", {
    hitRate: cacheInfo.percent,
    input: cacheInfo.input,
    cacheRead: cacheInfo.cacheRead,
    reason: cacheInfo.cacheUnavailableReason ?? null,
    contextTokens: usage?.tokens ?? null,
    contextWindow: usage?.contextWindow ?? null,
    lastDcp,
  });
}

function publishStatus(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
  lastDcp: DcpStatusMetrics,
  shouldLog: boolean = false,
): void {
  const usage = ctx.getContextUsage();
  const entries = ctx.sessionManager.getBranch() as CacheUsageEntry[];
  const cacheInfo = formatCacheHit(entries);

  if (shouldLog) {
    logCacheStatus(logger, cacheInfo, usage, lastDcp);
  }

  const contextText = `ctx ${formatCurrentUsage(usage)}`;
  const styledContext = isContextOverLimit(usage)
    ? ctx.ui.theme.fg("warning", contextText)
    : ctx.ui.theme.fg("dim", contextText);
  const savedText = `saved ${formatK(lastDcp.estimatedSavedTokens)}`;
  const styledSaved = ctx.ui.theme.fg("dim", savedText);
  const styledCache = isCacheBelowThreshold(cacheInfo)
    ? ctx.ui.theme.fg("warning", cacheInfo.text)
    : ctx.ui.theme.fg("dim", cacheInfo.text);

  ctx.ui.setStatus(
    STATUS_KEY,
    `${styledContext}${ctx.ui.theme.fg("dim", " ")}${styledSaved}${ctx.ui.theme.fg("dim", " ")}${styledCache}`,
  );
}

export function computeAndPublishStatus(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
  lastDcp: DcpStatusMetrics = emptyDcpMetrics(),
  shouldLog: boolean = false,
): void {
  try {
    publishStatus(ctx, logger, lastDcp, shouldLog);
  } catch (error) {
    logger.log("status_error", failureDetails(error));
  }
}
