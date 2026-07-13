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

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export type CodexAdapterCredentials = {
  accessToken: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toRemainingPercent(
  window: CodexUsageWindow | undefined,
): number | undefined {
  if (window == null) return undefined;
  if (typeof window.remaining_percent === "number") {
    return clampPercent(window.remaining_percent);
  }
  if (typeof window.used_percent === "number") {
    return clampPercent(100 - window.used_percent);
  }
  return undefined;
}

function parseIsoSeconds(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

function parseCredits(
  credits: CodexUsageResponse["credits"] | undefined,
): number | undefined {
  const balance = credits?.balance;
  const unlimited = credits?.unlimited;
  if (unlimited) return undefined;
  const value = typeof balance === "number" ? balance : Number(balance);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
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
      signal,
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

    const extras: SourceExtras = {
      credits: parseCredits(usage.credits),
      bankedResets: toBankedResetsState(resetResponse),
    };

    logger.log("fetch_succeeded", {
      provider: PROVIDER_ID,
      has5h: primary != null,
      has7d: secondary != null,
      hasCredits: extras.credits != null,
      hasBankedResets: extras.bankedResets != null,
    });

    return {
      state: "ok",
      windows: {
        rolling: toWindow(primary),
        weekly: toWindow(secondary),
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
