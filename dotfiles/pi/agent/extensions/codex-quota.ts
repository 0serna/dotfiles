import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { log } from "./shared/logger.js";

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

type CodexQuotaStatus = {
  remaining5h?: number;
  remaining7d?: number;
  remainingCredits?: number;
  resetAfter5h?: number;
  resetAfter7d?: number;
};

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const STATUS_KEY = "codex-quota";
const CACHE_FILE = "/tmp/pi-codex-quota-cache.json";
const CODEX_PROVIDER_ID = "openai-codex";
const AUTH_MISSING_STATUS = "codex auth missing";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let lastStatus: CodexQuotaStatus | null = null;
let lastCtx: ExtensionContext | null = null;
let poller: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readCache(): Promise<CodexQuotaStatus | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as CodexQuotaStatus;
  } catch {
    return null;
  }
}

function writeCache(status: CodexQuotaStatus): void {
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
      log("codex-quota", "auth_missing", { provider: CODEX_PROVIDER_ID });
      return null;
    }
    log("codex-quota", "auth_loaded", { provider: CODEX_PROVIDER_ID });
    return accessToken.trim();
  } catch (error) {
    log("codex-quota", "auth_error", {
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
    log("codex-quota", "fetch_failed", { status: response.status });
    return null;
  }
  return (await response.json()) as CodexUsageResponse;
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return "<1m";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

type SegmentConfig = {
  key: keyof CodexQuotaStatus;
  suffix: string;
  /** Default label. Overridden by resetField when available. */
  label?: string;
  /** If set, compute dynamic label from this reset-duration field. */
  resetField?: keyof CodexQuotaStatus;
  /** Warn (mdHeading) when value drops below this threshold. Omit to never warn. */
  warnThreshold?: number;
};

const QUOTA_SEGMENTS: SegmentConfig[] = [
  {
    key: "remaining5h",
    suffix: "%",
    resetField: "resetAfter5h",
    label: "5h",
    warnThreshold: 25,
  },
  {
    key: "remaining7d",
    suffix: "%",
    resetField: "resetAfter7d",
    label: "7d",
    warnThreshold: 10,
  },
  {
    key: "remainingCredits",
    suffix: "",
    label: "C",
  },
];

function getSegmentLabel(
  segment: SegmentConfig,
  status: CodexQuotaStatus,
): string {
  if (segment.resetField) {
    const resetSeconds = status[segment.resetField];
    if (resetSeconds != null) return formatDuration(resetSeconds);
  }
  return segment.label ?? "?";
}

function buildSegmentString(
  label: string,
  value: number,
  suffix: string,
): string {
  return suffix ? `${value}${suffix} ${label}` : `${label} ${value}${suffix}`;
}

function formatCodexQuotaSegment(
  segment: SegmentConfig,
  status: CodexQuotaStatus,
  ctx: ExtensionContext,
): string | null {
  const value = status[segment.key];
  if (value == null) return null;
  const label = getSegmentLabel(segment, status);
  const segmentStr = buildSegmentString(label, value, segment.suffix);
  if (segment.warnThreshold != null && value < segment.warnThreshold) {
    return ctx.ui.theme.fg("mdHeading", segmentStr);
  }
  return ctx.ui.theme.fg("dim", segmentStr);
}

function formatCodexQuotaStatus(
  status: CodexQuotaStatus,
  ctx: ExtensionContext,
): string | null {
  const parts = QUOTA_SEGMENTS.map((s) =>
    formatCodexQuotaSegment(s, status, ctx),
  ).filter((p): p is string => p != null);
  return parts.length ? parts.join(ctx.ui.theme.fg("dim", " · ")) : null;
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

function resetSeconds(
  window: CodexUsageWindow | undefined,
): number | undefined {
  return window?.reset_after_seconds;
}

function buildStatusFromUsage(usage: CodexUsageResponse): CodexQuotaStatus {
  const rateLimit = usage.rate_limit ?? usage.rate_limits;
  const primary = rateLimit?.primary_window;
  const secondary = rateLimit?.secondary_window;
  return {
    remaining5h: toRemainingPercent(primary),
    remaining7d: toRemainingPercent(secondary),
    remainingCredits: getCreditsFromResponse(usage.credits),
    resetAfter5h: resetSeconds(primary),
    resetAfter7d: resetSeconds(secondary),
  };
}

async function fetchCodexQuotaStatus(
  ctx: ExtensionContext,
): Promise<CodexQuotaStatus | null> {
  const accessToken = await loadCodexAccessToken(ctx);
  if (!accessToken) {
    setStatusSafely(ctx, "auth_missing", AUTH_MISSING_STATUS);
    return null;
  }
  const usage =
    (await callCodexUsageApi(accessToken)) ??
    (await callCodexUsageApi(accessToken));
  if (!usage) return null;
  const status = buildStatusFromUsage(usage);
  log("codex-quota", "fetch_succeeded", {
    provider: CODEX_PROVIDER_ID,
    has5h: status.remaining5h != null,
    has7d: status.remaining7d != null,
    hasCredits: status.remainingCredits != null,
  });
  return status;
}

// ---------------------------------------------------------------------------
// Status publish helpers
// ---------------------------------------------------------------------------

function getStatusText(ctx: ExtensionContext): string | undefined {
  if (!lastStatus) return undefined;
  return formatCodexQuotaStatus(lastStatus, ctx) ?? undefined;
}

function setStatusSafely(
  ctx: ExtensionContext,
  reason: string,
  statusText: string | undefined,
): void {
  try {
    ctx.ui.setStatus(STATUS_KEY, statusText);
  } catch (error) {
    log("codex-quota", "status_publish_error", {
      reason,
      message: getErrorMessage(error),
    });
  }
}

function publishStatus(ctx: ExtensionContext, reason: string): void {
  if (!lastStatus) {
    log("codex-quota", "status_skipped", { reason });
    return;
  }
  const statusText = getStatusText(ctx);
  log("codex-quota", "status_published", { reason, status: statusText });
  setStatusSafely(ctx, reason, statusText);
}

function publishLatest(reason: string): void {
  if (lastCtx) publishStatus(lastCtx, reason);
}

function applyStatus(status: CodexQuotaStatus | null): void {
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
    log("codex-quota", "status_skipped", { reason, message: "no context" });
    return;
  }
  try {
    const status = await fetchCodexQuotaStatus(ctx);
    log("codex-quota", "status_resolved", { reason, status });
    applyStatus(status);
  } catch (error) {
    log("codex-quota", "status_error", {
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
  log("codex-quota", "extension_loaded", {
    cwd: ctx.cwd,
    model: ctx.model?.id ?? null,
  });
  void readCache().then((cached) => {
    if (cached) {
      lastStatus = cached;
      publishStatus(ctx, "session_start_cached");
    }
  });
  void refreshStatus("session_start");
  ensurePoller();
}

function handleTurnStart(_event: unknown, ctx: ExtensionContext): void {
  lastCtx = ctx;
  publishStatus(ctx, "turn_start");
}

function handleTurnEnd(_event: unknown, ctx: ExtensionContext): void {
  lastCtx = ctx;
  publishStatus(ctx, "turn_end");
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
