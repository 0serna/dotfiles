import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "./shared/logger.js";

type CodexUsageWindow = {
  used_percent?: number;
  remaining_percent?: number;
  reset_after_seconds?: number;
  reset_at?: number;
  limit_window_seconds?: number;
};

type CodexUsageResponse = {
  rate_limit?: {
    primary_window?: CodexUsageWindow;
    secondary_window?: CodexUsageWindow;
  };
  rate_limits?: {
    primary_window?: CodexUsageWindow;
    secondary_window?: CodexUsageWindow;
  };
  credits?: {
    has_credits?: boolean;
    unlimited?: boolean;
    balance?: number | string;
  };
};

type CodexQuotaData = {
  remaining5h?: number;
  remaining7d?: number;
  remainingCredits?: number;
  resetAt5h?: number;
  resetAt7d?: number;
};

type OpenCodeGoWindowData = {
  remainingPercent: number;
  resetInSec: number;
};

type OpenCodeGoData = {
  rolling?: OpenCodeGoWindowData;
  weekly?: OpenCodeGoWindowData;
  monthly?: OpenCodeGoWindowData;
  balanceDollars?: number;
};

type UsageQuotaStatus = {
  codex: CodexQuotaData | null;
  codexError: string | null;
  opencodeGo: OpenCodeGoData | null;
  opencodeGoError: string | null;
};

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const LOW_QUOTA_THRESHOLD_PERCENT = 20;
const STATUS_KEY = "usage-quota";
const CACHE_FILE = "/tmp/pi-usage-quota-cache.json";
const CODEX_PROVIDER_ID = "openai-codex";

const GO_WORKSPACE_ID_ENV = "OPENCODE_GO_WORKSPACE_ID";
const GO_AUTH_COOKIE_ENV = "OPENCODE_GO_AUTH_COOKIE";

function isGoConfigured(): boolean {
  return Boolean(
    process.env[GO_WORKSPACE_ID_ENV]?.trim() &&
    process.env[GO_AUTH_COOKIE_ENV]?.trim(),
  );
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let lastStatus: UsageQuotaStatus | null = null;
let lastCtx: ExtensionContext | null = null;
let poller: ReturnType<typeof setInterval> | null = null;
let logger: ExtensionLogger; // created in handleSessionStart

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readCache(): Promise<UsageQuotaStatus | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as UsageQuotaStatus;
  } catch {
    return null;
  }
}

function writeCache(status: UsageQuotaStatus): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(status), "utf8");
  } catch {
    return;
  }
}

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

function parseCredits(
  balance: number | string | undefined,
  unlimited: boolean | undefined,
): number | undefined {
  if (unlimited) return undefined;
  const value = typeof balance === "number" ? balance : Number(balance);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

// ---------------------------------------------------------------------------
// Auth loading
// ---------------------------------------------------------------------------

async function loadCodexAccessToken(
  ctx: ExtensionContext,
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
      message: getErrorMessage(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callCodexUsageApi(
  accessToken: string,
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
// OpenCode Go dashboard fetch
// ---------------------------------------------------------------------------

const GO_DASHBOARD_URL = "https://opencode.ai/workspace";

async function fetchGoDashboardHtml(): Promise<string | null> {
  const workspaceId = process.env[GO_WORKSPACE_ID_ENV]?.trim();
  const authCookie = process.env[GO_AUTH_COOKIE_ENV]?.trim();
  if (!workspaceId || !authCookie) return null;
  try {
    const response = await fetch(`${GO_DASHBOARD_URL}/${workspaceId}/go`, {
      headers: {
        Cookie: `auth=${authCookie}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.log("go_fetch_failed", { status: response.status });
      return null;
    }
    return await response.text();
  } catch (error) {
    logger.log("go_fetch_error", { message: getErrorMessage(error) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenCode Go dashboard parsing
// ---------------------------------------------------------------------------

/**
 * Find and parse the hydration JSON blob embedded in the dashboard HTML.
 * The SolidJS-serialized state is found by searching for known keys.
 */
function parseGoDashboard(html: string): OpenCodeGoData | null {
  const data: OpenCodeGoData = parseGoHydrationLiterals(html) ?? {};

  // Locate JSON-like structures by finding '{' and matching balanced braces,
  // then walk parsed JSON trees for our keys when the payload is valid JSON.
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;

  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const content = scriptMatch[1]!;

    const candidates = findJsonContainingKeys(content, [
      "rollingUsage",
      "weeklyUsage",
      "monthlyUsage",
      "balance",
    ]);

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const extracted = extractGoData(parsed);
        if (extracted) Object.assign(data, extracted);
      } catch {
        // skip unparseable candidate
      }
    }

    if (data.rolling || data.weekly || data.monthly) break;
  }

  return data.rolling || data.weekly || data.monthly ? data : null;
}

function parseGoHydrationLiterals(html: string): OpenCodeGoData | null {
  const data: OpenCodeGoData = {};
  data.rolling = parseGoHydrationWindow(html, "rollingUsage");
  data.weekly = parseGoHydrationWindow(html, "weeklyUsage");
  data.monthly = parseGoHydrationWindow(html, "monthlyUsage");

  const balance = /\bbalance:(\d+)/.exec(html);
  if (balance?.[1])
    data.balanceDollars = rawBalanceToDollars(Number(balance[1]));

  return data.rolling ||
    data.weekly ||
    data.monthly ||
    data.balanceDollars != null
    ? data
    : null;
}

function parseGoHydrationWindow(
  html: string,
  key: string,
): OpenCodeGoWindowData | undefined {
  const match = new RegExp(`${key}:\\$R\\[\\d+\\]=\\{([^}]*)\\}`).exec(html);
  const body = match?.[1];
  if (!body) return undefined;

  const usagePercent = /\busagePercent:(\d+(?:\.\d+)?)/.exec(body)?.[1];
  const resetInSec = /\bresetInSec:(\d+(?:\.\d+)?)/.exec(body)?.[1];
  if (usagePercent == null || resetInSec == null) return undefined;

  return {
    remainingPercent: Math.max(0, Math.min(100, 100 - Number(usagePercent))),
    resetInSec: Number(resetInSec),
  };
}

/** Find JSON substrings that contain all given keys (at any nesting). */
function findJsonContainingKeys(text: string, keys: string[]): string[] {
  const results: string[] = [];
  let start = 0;

  while (start < text.length) {
    const braceStart = text.indexOf("{", start);
    if (braceStart === -1) break;

    // Check if this brace region contains at least one of our keys
    const snippet = text.slice(braceStart, braceStart + 5000);
    const hasKey = keys.some((k) => snippet.includes(`"${k}"`));
    if (!hasKey) {
      start = braceStart + 1;
      continue;
    }

    // Match balanced braces
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;

    results.push(text.slice(braceStart, end));
    start = end;
  }

  return results;
}

/** Walk a parsed JSON object and extract OpenCode Go fields. */
function extractGoData(
  obj: unknown,
  depth = 0,
): Partial<OpenCodeGoData> | null {
  if (depth > 15 || typeof obj !== "object" || obj === null) return null;

  const result: Partial<OpenCodeGoData> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "rollingUsage" && isUsageWindow(value)) {
      result.rolling = usageWindowToData(value);
    } else if (key === "weeklyUsage" && isUsageWindow(value)) {
      result.weekly = usageWindowToData(value);
    } else if (key === "monthlyUsage" && isUsageWindow(value)) {
      result.monthly = usageWindowToData(value);
    } else if (key === "balance" && typeof value === "number") {
      result.balanceDollars = rawBalanceToDollars(value);
    } else if (typeof value === "object" && value !== null) {
      const nested = extractGoData(value, depth + 1);
      if (nested) Object.assign(result, nested);
    }
  }

  return result.rolling ||
    result.weekly ||
    result.monthly ||
    result.balanceDollars != null
    ? result
    : null;
}

function isUsageWindow(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>)["usagePercent"] === "number" &&
    typeof (v as Record<string, unknown>)["resetInSec"] === "number"
  );
}

function usageWindowToData(w: Record<string, unknown>): OpenCodeGoWindowData {
  return {
    remainingPercent: Math.max(
      0,
      Math.min(100, 100 - (w["usagePercent"] as number)),
    ),
    resetInSec: w["resetInSec"] as number,
  };
}

function rawBalanceToDollars(raw: number): number {
  // Observed raw value 670023194 ~ $6.70, verified conversion
  return Math.round((raw / 100_000_000) * 100) / 100;
}

/** Fetch + parse OpenCode Go dashboard, returning structured data or null. */
async function fetchOpenCodeGoData(): Promise<OpenCodeGoData | null> {
  if (!isGoConfigured()) {
    logger.log("go_skipped", { reason: "not configured" });
    return null;
  }
  const html = await fetchGoDashboardHtml();
  if (!html) {
    logger.log("go_fetch_failed", { reason: "no html" });
    return null;
  }
  const data = parseGoDashboard(html);
  if (!data) {
    logger.log("go_parse_failed", { reason: "no matching data found" });
    return null;
  }
  logger.log("go_fetch_succeeded", {
    hasRolling: data.rolling != null,
    hasWeekly: data.weekly != null,
    hasMonthly: data.monthly != null,
    hasBalance: data.balanceDollars != null,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Reset time formatting
// ---------------------------------------------------------------------------

function formatResetTime(resetAt: number): string {
  const date = new Date(resetAt * 1000);
  const h12 = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${h12}:${minutes}`;

  if (date.toDateString() === new Date().toDateString()) return `(${timeStr})`;
  const days = Math.max(
    1,
    Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return `(${days}d)`;
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

function buildSegmentString(
  label: string,
  value: number,
  suffix: string,
): string {
  return suffix ? `${value}${suffix} ${label}` : `${label} ${value}${suffix}`;
}

type SegmentConfig = {
  key: keyof CodexQuotaData;
  suffix: string;
  /** Default label. Overridden by resetField when available. */
  label?: string;
  /** If set, compute dynamic label (reset time) from this timestamp field. */
  resetField?: keyof CodexQuotaData;
};

const QUOTA_SEGMENTS: SegmentConfig[] = [
  {
    key: "remaining5h",
    suffix: "%",
    resetField: "resetAt5h",
  },
  {
    key: "remaining7d",
    suffix: "%",
    resetField: "resetAt7d",
  },
  {
    key: "remainingCredits",
    suffix: "",
    label: "C",
  },
];

function getSegmentLabel(segment: SegmentConfig, data: CodexQuotaData): string {
  if (segment.resetField) {
    const resetAt = data[segment.resetField];
    if (resetAt != null) return formatResetTime(resetAt);
  }
  return segment.label ?? "?";
}

function formatCodexQuotaSegment(
  segment: SegmentConfig,
  data: CodexQuotaData,
  ctx: ExtensionContext,
): string | null {
  const value = data[segment.key];
  if (value == null) return null;
  const label = getSegmentLabel(segment, data);
  const segmentStr = buildSegmentString(label, value, segment.suffix);
  if (segment.suffix === "%" && value < LOW_QUOTA_THRESHOLD_PERCENT) {
    return ctx.ui.theme.fg("mdHeading", segmentStr);
  }
  return ctx.ui.theme.fg("dim", segmentStr);
}

function formatCodexQuotaStatus(
  data: CodexQuotaData,
  ctx: ExtensionContext,
): string | null {
  const parts = QUOTA_SEGMENTS.map((s) =>
    formatCodexQuotaSegment(s, data, ctx),
  ).filter((p): p is string => p != null);
  return parts.length ? parts.join(ctx.ui.theme.fg("dim", " ")) : null;
}

// ---------------------------------------------------------------------------
// Fetch orchestration
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

function buildCodexData(usage: CodexUsageResponse): CodexQuotaData {
  const rateLimit = usage.rate_limit ?? usage.rate_limits;
  const primary = rateLimit?.primary_window;
  const secondary = rateLimit?.secondary_window;
  return {
    remaining5h: toRemainingPercent(primary),
    remaining7d: toRemainingPercent(secondary),
    remainingCredits: getCreditsFromResponse(usage.credits),
    resetAt5h: resetTimestamp(primary),
    resetAt7d: resetTimestamp(secondary),
  };
}

async function fetchCodexQuotaStatus(
  ctx: ExtensionContext,
): Promise<CodexQuotaData | null> {
  const accessToken = await loadCodexAccessToken(ctx);
  if (!accessToken) {
    return null;
  }
  const usage =
    (await callCodexUsageApi(accessToken)) ??
    (await callCodexUsageApi(accessToken));
  if (!usage) return null;
  const data = buildCodexData(usage);
  logger.log("fetch_succeeded", {
    provider: CODEX_PROVIDER_ID,
    has5h: data.remaining5h != null,
    has7d: data.remaining7d != null,
    hasCredits: data.remainingCredits != null,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Status publish helpers
// ---------------------------------------------------------------------------

function setStatusSafely(
  ctx: ExtensionContext,
  reason: string,
  statusText: string | undefined,
): void {
  try {
    ctx.ui.setStatus(STATUS_KEY, statusText);
  } catch (error) {
    logger.log("status_publish_error", {
      reason,
      message: getErrorMessage(error),
    });
  }
}

// ---------------------------------------------------------------------------
// OpenCode Go formatting
// ---------------------------------------------------------------------------

function formatGoResetTime(resetInSec: number): string {
  return formatResetTime(Math.floor(Date.now() / 1000) + resetInSec);
}

function formatGoSegment(
  remainingPercent: number | undefined,
  resetInSec: number | undefined,
  ctx: ExtensionContext,
): string | null {
  if (remainingPercent == null) return null;
  const resetLabel = resetInSec != null ? formatGoResetTime(resetInSec) : null;
  const segment = resetLabel
    ? `${remainingPercent}% ${resetLabel}`
    : `${remainingPercent}%`;
  if (remainingPercent < LOW_QUOTA_THRESHOLD_PERCENT) {
    return ctx.ui.theme.fg("mdHeading", segment);
  }
  return ctx.ui.theme.fg("dim", segment);
}

function formatGoBalances(
  data: OpenCodeGoData,
  ctx: ExtensionContext,
): string | null {
  const windows = [data.rolling, data.weekly, data.monthly];
  const goParts = windows
    .map((window) =>
      formatGoSegment(window?.remainingPercent, window?.resetInSec, ctx),
    )
    .filter((part): part is string => part != null);

  if (data.balanceDollars != null) {
    goParts.push(ctx.ui.theme.fg("dim", `$${data.balanceDollars.toFixed(2)}`));
  }

  return goParts.length ? goParts.join(ctx.ui.theme.fg("dim", " ")) : null;
}

// ---------------------------------------------------------------------------
// Status publish helpers
// ---------------------------------------------------------------------------

function formatProviderStatus<T>(
  label: string,
  error: string | null,
  data: T | null,
  formatter: (data: T, ctx: ExtensionContext) => string | null,
  ctx: ExtensionContext,
): string {
  if (error || !data) return ctx.ui.theme.fg("mdHeading", `${label}: error`);
  return `${ctx.ui.theme.fg("dim", `${label}: `)}${formatter(data, ctx)}`;
}

function publishCombinedStatus(ctx: ExtensionContext, reason: string): void {
  if (!lastStatus) {
    logger.log("status_skipped", { reason });
    return;
  }

  const goStatus = formatProviderStatus(
    "GO",
    lastStatus.opencodeGoError,
    lastStatus.opencodeGo,
    formatGoBalances,
    ctx,
  );
  const codexStatus = formatProviderStatus(
    "CODEX",
    lastStatus.codexError,
    lastStatus.codex,
    formatCodexQuotaStatus,
    ctx,
  );

  const statusText = `${goStatus}${ctx.ui.theme.fg("dim", " │ ")}${codexStatus}`;
  logger.log("status_published", { reason, status: statusText });
  setStatusSafely(ctx, reason, statusText);
}

function publishLatest(reason: string): void {
  if (lastCtx) publishCombinedStatus(lastCtx, reason);
}

function applyCombinedStatus(status: UsageQuotaStatus | null): void {
  if (!status) return;
  lastStatus = status;
  writeCache(status);
  publishLatest("fetch_refreshed");
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

async function refreshStatus(reason: string): Promise<void> {
  const ctx = lastCtx;
  if (!ctx) {
    logger.log("status_skipped", { reason, message: "no context" });
    return;
  }
  try {
    const prevCodex = lastStatus?.codex ?? null;
    const prevGo = lastStatus?.opencodeGo ?? null;

    // Fetch both providers in parallel
    const [codexData, goData] = await Promise.all([
      fetchCodexQuotaStatus(ctx),
      fetchOpenCodeGoData(),
    ]);

    // Determine Codex result: use fresh data, else preserve cached, else mark error
    const codex: CodexQuotaData | null = codexData ?? prevCodex;
    const codexError: string | null = codexData ? null : "fetch_failed";

    // Determine OpenCode Go result similarly
    const opencodeGo: OpenCodeGoData | null = goData ?? prevGo;
    const opencodeGoError: string | null = goData ? null : "fetch_failed";

    const merged: UsageQuotaStatus = {
      codex,
      codexError,
      opencodeGo,
      opencodeGoError,
    };

    logger.log("status_resolved", {
      reason,
      hasCodex: codex != null,
      hasGo: opencodeGo != null,
      codexError: codexError ?? undefined,
      goError: opencodeGoError ?? undefined,
    });
    applyCombinedStatus(merged);
  } catch (error) {
    logger.log("status_error", {
      reason,
      message: getErrorMessage(error),
    });
  }
}

function ensurePoller(): void {
  if (poller) return;
  poller = setInterval(() => {
    void refreshStatus("poll");
  }, POLL_INTERVAL_MS);
  poller.unref?.();
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function handleSessionStart(_event: unknown, ctx: ExtensionContext): void {
  lastCtx = ctx;
  logger = createExtensionLogger(ctx, "usage-quota");
  void readCache().then((cached) => {
    if (cached) {
      lastStatus = cached;
      publishCombinedStatus(ctx, "session_start_cached");
    }
  });
  void refreshStatus("session_start");
  ensurePoller();
}

function handleTurnStart(_event: unknown, ctx: ExtensionContext): void {
  lastCtx = ctx;
  publishCombinedStatus(ctx, "turn_start");
}

function handleTurnEnd(_event: unknown, ctx: ExtensionContext): void {
  lastCtx = ctx;
  publishCombinedStatus(ctx, "turn_end");
}

function handleSessionShutdown(): void {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
  lastCtx = null;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", handleSessionStart);
  pi.on("turn_start", handleTurnStart);
  pi.on("turn_end", handleTurnEnd);
  pi.on("session_shutdown", handleSessionShutdown);
}
