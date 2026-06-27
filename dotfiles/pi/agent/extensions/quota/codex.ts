import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import { parseCredits, toRemainingPercent } from "./status.js";
import type {
  CodexQuotaData,
  CodexUsageResponse,
  CodexUsageWindow,
  ExtensionContext,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT_MS = 10000;
const CODEX_PROVIDER_ID = "openai-codex";

// ---------------------------------------------------------------------------
// Auth loading
// ---------------------------------------------------------------------------

async function loadCodexAccessToken(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
): Promise<string | null> {
  try {
    const accessToken =
      await ctx.modelRegistry.authStorage.getApiKey(CODEX_PROVIDER_ID);
    if (!accessToken?.trim()) {
      logger.log("auth_missing", { provider: CODEX_PROVIDER_ID });
      return null;
    }
    logger.log("auth_loaded", { provider: CODEX_PROVIDER_ID });
    return accessToken.trim();
  } catch (error) {
    logger.log("auth_error", {
      provider: CODEX_PROVIDER_ID,
      ...failureDetails(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callCodexUsageApi(
  accessToken: string,
  logger: ExtensionLogger,
): Promise<CodexUsageResponse | null> {
  const response = await fetch(CODEX_USAGE_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    logger.log("fetch_failed", { status: response.status });
    return null;
  }
  return (await response.json()) as CodexUsageResponse;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function getCreditsFromResponse(
  credits: CodexUsageResponse["credits"] | undefined,
): number | undefined {
  if (!credits?.has_credits) return undefined;
  return parseCredits(credits.balance, credits.unlimited);
}

function getBankedResetCredits(
  resetCredits: CodexUsageResponse["rate_limit_reset_credits"],
): number | undefined {
  if (
    resetCredits == null ||
    typeof resetCredits.available_count !== "number" ||
    !Number.isFinite(resetCredits.available_count)
  ) {
    return undefined;
  }
  const count = resetCredits.available_count;
  return count >= 0 ? Math.floor(count) : undefined;
}

function resetTimestamp(
  window: CodexUsageWindow | undefined,
): number | undefined {
  return window?.reset_at;
}

function buildCodexData(usage: CodexUsageResponse): CodexQuotaData {
  const rateLimit = usage.rate_limit ?? usage.rate_limits;
  const primary = rateLimit?.primary_window;
  const secondary = rateLimit?.secondary_window;
  return {
    remaining5h: toRemainingPercent(primary),
    remaining7d: toRemainingPercent(secondary),
    remainingCredits: getCreditsFromResponse(usage.credits),
    bankedResetCredits: getBankedResetCredits(usage.rate_limit_reset_credits),
    resetAt5h: resetTimestamp(primary),
    resetAt7d: resetTimestamp(secondary),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchCodexQuotaStatus(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
): Promise<CodexQuotaData | null> {
  const accessToken = await loadCodexAccessToken(ctx, logger);
  if (!accessToken) {
    return null;
  }
  const usage =
    (await callCodexUsageApi(accessToken, logger)) ??
    (await callCodexUsageApi(accessToken, logger));
  if (!usage) return null;
  const data = buildCodexData(usage);
  logger.log("fetch_succeeded", {
    provider: CODEX_PROVIDER_ID,
    has5h: data.remaining5h != null,
    has7d: data.remaining7d != null,
    hasCredits: data.remainingCredits != null,
    hasBankedResets: data.bankedResetCredits != null,
  });
  return data;
}
