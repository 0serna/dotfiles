import { failureDetails } from "../../shared/diagnostics.ts";
import type {
  AdapterLogger,
  AdapterResult,
  QuotaAdapter,
} from "../adapter-registry.js";
import type {
  SourceDescriptor,
  SourceExtras,
  SourceWindow,
} from "../snapshot.js";
import { parseCredits, toRemainingPercent } from "../status.js";
import type {
  CodexResetCreditsResponse,
  CodexUsageResponse,
  CodexUsageWindow,
} from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_RESET_CREDITS_URL =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const PROVIDER_ID = "openai-codex";
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export type CodexAdapterCredentials = {
  accessToken: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIsoSeconds(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

type BankedResetDetail = {
  expiresAt: number;
  grantedAt: number;
  status: string;
};

function buildBankedResetDetails(
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

function toWindow(
  window: CodexUsageWindow | undefined,
): SourceWindow | undefined {
  const remaining = toRemainingPercent(window);
  if (remaining == null || window?.reset_at == null) return undefined;
  return { remainingPercent: remaining, resetAt: window.reset_at };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  logger: AdapterLogger,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    });
    if (!response.ok) {
      logger.log("fetch_failed", {
        url,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    logger.log("fetch_error", {
      url,
      ...failureDetails(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Window classification
// ---------------------------------------------------------------------------

/** Threshold in seconds: windows ≤ 6h are rolling, everything else is weekly. */
const ROLLING_MAX_SECONDS = 6 * 60 * 60;

function classifyWindow(
  primary: CodexUsageWindow | undefined,
  secondary: CodexUsageWindow | undefined,
  kind: "rolling" | "weekly",
): CodexUsageWindow | undefined {
  const candidates = [primary, secondary].filter(
    (w): w is CodexUsageWindow => w != null,
  );
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) {
    // Single window: use heuristics based on duration if available.
    const only = candidates[0]!;
    const secs = only.limit_window_seconds;
    if (secs != null && secs > 0) {
      const isRolling = secs <= ROLLING_MAX_SECONDS;
      if (kind === "rolling") return isRolling ? only : undefined;
      return isRolling ? undefined : only;
    }
    // No duration info: assume the single window is rolling.
    return kind === "rolling" ? only : undefined;
  }
  // Two windows: classify by duration when available, fall back to position.
  const [a, b] = candidates;
  const aSecs = a?.limit_window_seconds;
  const bSecs = b?.limit_window_seconds;
  const aIsRolling =
    aSecs != null && aSecs > 0 ? aSecs <= ROLLING_MAX_SECONDS : undefined;
  const bIsRolling =
    bSecs != null && bSecs > 0 ? bSecs <= ROLLING_MAX_SECONDS : undefined;

  // Determine which candidate is the rolling window from available data.
  let rolling: CodexUsageWindow | undefined;
  if (aIsRolling === true) {
    rolling = a;
  } else if (aIsRolling === false) {
    rolling = b; // a is weekly → b must be rolling
  } else if (bIsRolling === true) {
    rolling = b;
  } else if (bIsRolling === false) {
    rolling = a; // b is weekly → a must be rolling
  }

  if (rolling !== undefined) {
    if (kind === "rolling") return rolling;
    return rolling === a ? b : a;
  }

  // No duration info at all: positional fallback (primary = rolling).
  if (kind === "rolling") return primary;
  return secondary;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const codexAdapter: QuotaAdapter = {
  providerId: PROVIDER_ID,

  describe(input): SourceDescriptor {
    return {
      identity: {
        providerId: PROVIDER_ID,
        sourceId: input.sourceId,
      },
      displayName: "Codex",
      compactPrefix: "Codex",
      configFingerprint:
        input.configFingerprint ?? `fingerprint:openai-codex:${input.sourceId}`,
    };
  },

  async fetch(input, signal, logger): Promise<AdapterResult> {
    const credentials = input.credentials as
      | Partial<CodexAdapterCredentials>
      | undefined;
    const accessToken = credentials?.accessToken?.trim();
    if (!accessToken) {
      logger.log("auth_missing", { provider: PROVIDER_ID });
      return { state: "skipped", reason: "auth_missing" };
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    const usage = await fetchJson<CodexUsageResponse>(
      CODEX_USAGE_URL,
      headers,
      signal,
      logger,
    );
    if (!usage) {
      return { state: "error", reason: "fetch_failed" };
    }

    const resetResponse = await fetchJson<CodexResetCreditsResponse>(
      CODEX_RESET_CREDITS_URL,
      headers,
      signal,
      logger,
    );

    const rateLimit = usage.rate_limit ?? usage.rate_limits;
    const primary = rateLimit?.primary_window;
    const secondary = rateLimit?.secondary_window;

    // Classify windows by actual duration rather than primary/secondary position.
    // Rolling window is ~5h (≤ 6h), weekly window is ~7d.
    const rollingWindow = classifyWindow(primary, secondary, "rolling");
    const weeklyWindow = classifyWindow(primary, secondary, "weekly");

    const extras: SourceExtras = {
      credits: parseCredits(usage.credits?.balance, usage.credits?.unlimited),
      bankedResets: toBankedResetsState(resetResponse),
    };

    logger.log("fetch_succeeded", {
      provider: PROVIDER_ID,
      hasRolling: rollingWindow != null,
      hasWeekly: weeklyWindow != null,
      hasCredits: extras.credits != null,
      hasBankedResets: extras.bankedResets != null,
    });

    return {
      state: "ok",
      windows: {
        rolling: toWindow(rollingWindow),
        weekly: toWindow(weeklyWindow),
      },
      extras,
    };
  },
};

function toBankedResetsState(
  response: CodexResetCreditsResponse | null,
): SourceExtras["bankedResets"] {
  if (response == null) return { kind: "unavailable" };
  const details = buildBankedResetDetails(response);
  if (details == null) return { kind: "unavailable" };
  if (details.length === 0) return { kind: "empty" };
  return { kind: "available", details };
}
