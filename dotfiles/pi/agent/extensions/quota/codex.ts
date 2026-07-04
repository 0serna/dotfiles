import { failureDetails } from "../shared/diagnostics.ts";
import type { ExtensionLogger } from "../shared/logger.js";
import { parseCredits, toRemainingPercent } from "./status.js";
import type {
  BankedResetDetail,
  CodexQuotaData,
  CodexResetCreditsResponse,
  CodexUsageResponse,
  CodexUsageWindow,
  ExtensionContext,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_RESET_CREDITS_URL =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
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
// API calls
// ---------------------------------------------------------------------------

async function fetchCodex<T>(
  url: string,
  accessToken: string,
  logger: ExtensionLogger,
): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
      return (await response.json()) as T;
    }
    logger.log("fetch_failed", { url, status: response.status, attempt });
  }
  return null;
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

function resetTimestamp(
  window: CodexUsageWindow | undefined,
): number | undefined {
  return window?.reset_at;
}

function parseIsoSeconds(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

export function buildBankedResetDetails(
  response: CodexResetCreditsResponse | null,
): BankedResetDetail[] | undefined {
  if (!response || !Array.isArray(response.credits)) return undefined;
  const details: BankedResetDetail[] = [];
  for (const credit of response.credits) {
    if (credit.status !== "available") continue;
    const expiresAt = parseIsoSeconds(credit.expires_at);
    if (expiresAt == null) continue;
    details.push({
      expiresAt,
      grantedAt: parseIsoSeconds(credit.granted_at) ?? 0,
      status: credit.status,
    });
  }
  details.sort((a, b) => a.expiresAt - b.expiresAt);
  return details;
}

function buildCodexData(
  usage: CodexUsageResponse,
  resetDetails: BankedResetDetail[] | undefined,
): CodexQuotaData {
  const rateLimit = usage.rate_limit ?? usage.rate_limits;
  const primary = rateLimit?.primary_window;
  const secondary = rateLimit?.secondary_window;
  return {
    remaining5h: toRemainingPercent(primary),
    remaining7d: toRemainingPercent(secondary),
    remainingCredits: getCreditsFromResponse(usage.credits),
    bankedResetDetails: resetDetails,
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
  if (!accessToken) return null;
  const [usage, resetDetails] = await Promise.all([
    fetchCodex<CodexUsageResponse>(CODEX_USAGE_URL, accessToken, logger),
    fetchCodex<CodexResetCreditsResponse>(
      CODEX_RESET_CREDITS_URL,
      accessToken,
      logger,
    ),
  ]);
  if (!usage) return null;
  const data = buildCodexData(usage, buildBankedResetDetails(resetDetails));
  logger.log("fetch_succeeded", {
    provider: CODEX_PROVIDER_ID,
    has5h: data.remaining5h != null,
    has7d: data.remaining7d != null,
    hasCredits: data.remainingCredits != null,
    hasBankedResets: data.bankedResetDetails != null,
  });
  return data;
}
