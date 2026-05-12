import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFileSync, writeFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

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
};

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const STATUS_KEY = "codex-quota";
const LOG_FILE = "/tmp/pi-codex-quota.log";
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
// Logging & helpers
// ---------------------------------------------------------------------------

function logEvent(eventName: string, details: Record<string, unknown>): void {
  const line = [
    new Date().toISOString(),
    eventName,
    JSON.stringify(details),
  ].join(" ");
  try {
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    return;
  }
}

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
    logEvent("auth_missing", {});
    return null;
  }
  const auth = JSON.parse(await readFile(authPath, "utf8")) as CodexAuthFile;
  const resolvedAuth = getOpenAIAuthEntry(auth);
  logEvent("auth_loaded", {
    authPath,
    keys: Object.keys(auth),
    sourceKey: resolvedAuth?.sourceKey,
  });
  if (!resolvedAuth) {
    logEvent("auth_unusable", { authPath });
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
    logEvent("fetch_failed", { status: response.status });
    return null;
  }
  return (await response.json()) as CodexUsageResponse;
}

// ---------------------------------------------------------------------------
// Status formatting
// ---------------------------------------------------------------------------

const QUOTA_SEGMENTS: Array<{
  key: keyof CodexQuotaStatus;
  label: string;
  threshold: number;
  suffix: string;
}> = [
  { key: "remaining5h", label: "5h", threshold: 25, suffix: "%" },
  { key: "remaining7d", label: "7d", threshold: 25, suffix: "%" },
  { key: "remainingCredits", label: "cr", threshold: 100, suffix: "" },
];

function formatCodexQuotaSegment(
  label: string,
  value: number,
  threshold: number,
  ctx: ExtensionContext,
  suffix: string,
): string {
  const segment = `${label} ${value}${suffix}`;
  return value < threshold
    ? ctx.ui.theme.fg("mdHeading", segment)
    : ctx.ui.theme.fg("dim", segment);
}

function formatCodexQuotaStatus(
  status: CodexQuotaStatus,
  ctx: ExtensionContext,
): string | null {
  const parts = QUOTA_SEGMENTS.filter((s) => status[s.key] != null).map((s) =>
    formatCodexQuotaSegment(
      s.label,
      status[s.key]!,
      s.threshold,
      ctx,
      s.suffix,
    ),
  );
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

function buildStatusFromUsage(usage: CodexUsageResponse): CodexQuotaStatus {
  const rateLimit = usage.rate_limit ?? usage.rate_limits;
  return {
    remaining5h: rateLimit
      ? toRemainingPercent(rateLimit.primary_window)
      : undefined,
    remaining7d: rateLimit
      ? toRemainingPercent(rateLimit.secondary_window)
      : undefined,
    remainingCredits: getCreditsFromResponse(usage.credits),
  };
}

async function fetchCodexQuotaStatus(): Promise<CodexQuotaStatus | null> {
  const authResult = await loadCodexAuth();
  if (!authResult) return null;
  const { resolvedAuth } = authResult;
  const usage = await callCodexUsageApi(resolvedAuth);
  if (!usage) return null;
  const status = buildStatusFromUsage(usage);
  logEvent("fetch_succeeded", {
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
    logEvent("status_publish_error", {
      reason,
      message: getErrorMessage(error),
    });
  }
}

function publishStatus(ctx: ExtensionContext, reason: string): void {
  if (!lastStatus) {
    logEvent("status_skipped", { reason });
    return;
  }
  const statusText = getStatusText(ctx);
  logEvent("status_published", { reason, status: statusText });
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
    logEvent("status_resolved", { reason, status });
    applyStatus(status);
  } catch (error) {
    logEvent("status_error", {
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
  logEvent("extension_loaded", {
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
