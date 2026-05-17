import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "./shared/logger.js";

type OpenAIOAuthEntry = {
  type?: string;
  access?: string;
  refresh?: string;
  expires?: number;
  accountId?: string;
};

type CodexAuthFile = {
  openai?: OpenAIOAuthEntry;
  codex?: OpenAIOAuthEntry;
  chatgpt?: OpenAIOAuthEntry;
  opencode?: OpenAIOAuthEntry;
};

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
const OPENAI_AUTH_SOURCE_KEYS = [
  "openai",
  "codex",
  "chatgpt",
  "opencode",
] as const;

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findCodexAuthPath(): Promise<string | null> {
  const home = homedir();
  const candidates = [join(home, ".local/share/opencode/auth.json")];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return null;
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

function isValidAuthEntry(
  entry: OpenAIOAuthEntry | undefined,
): entry is OpenAIOAuthEntry & { access: string } {
  if (!entry) return false;
  if (entry.type !== "oauth") return false;
  if (typeof entry.access !== "string") return false;
  return true;
}

function getOpenAIAuthEntry(
  auth: CodexAuthFile,
): { sourceKey: string; entry: OpenAIOAuthEntry; accessToken: string } | null {
  for (const sk of OPENAI_AUTH_SOURCE_KEYS) {
    const entry = auth[sk];
    if (!isValidAuthEntry(entry)) continue;
    return { sourceKey: sk, entry, accessToken: entry.access.trim() };
  }
  return null;
}

async function loadCodexAuth(): Promise<{
  resolvedAuth: {
    sourceKey: string;
    entry: OpenAIOAuthEntry;
    accessToken: string;
  };
} | null> {
  const authPath = await findCodexAuthPath();
  if (!authPath) {
    log("codex-quota", "auth_missing", {});
    return null;
  }
  const auth = JSON.parse(await readFile(authPath, "utf8")) as CodexAuthFile;
  const resolvedAuth = getOpenAIAuthEntry(auth);
  log("codex-quota", "auth_loaded", {
    authPath,
    keys: Object.keys(auth),
    sourceKey: resolvedAuth?.sourceKey,
  });
  if (!resolvedAuth) {
    log("codex-quota", "auth_unusable", { authPath });
    return null;
  }
  return { resolvedAuth };
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callCodexUsageApi(resolvedAuth: {
  sourceKey: string;
  entry: OpenAIOAuthEntry;
  accessToken: string;
}): Promise<CodexUsageResponse | null> {
  const response = await fetch(CODEX_USAGE_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${resolvedAuth.accessToken}`,
      ...(resolvedAuth.entry.accountId
        ? { "ChatGPT-Account-Id": resolvedAuth.entry.accountId }
        : {}),
      Origin: "https://chatgpt.com",
      Referer: "https://chatgpt.com/",
      "User-Agent": "pi-codex-footer",
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

async function fetchCodexQuotaStatus(): Promise<CodexQuotaStatus | null> {
  const authResult = await loadCodexAuth();
  if (!authResult) return null;
  const { resolvedAuth } = authResult;
  const usage = await callCodexUsageApi(resolvedAuth);
  if (!usage) return null;
  const status = buildStatusFromUsage(usage);
  log("codex-quota", "fetch_succeeded", {
    sourceKey: resolvedAuth.sourceKey,
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
  try {
    const status = await fetchCodexQuotaStatus();
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
