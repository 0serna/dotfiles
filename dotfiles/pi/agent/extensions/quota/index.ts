import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { failureDetails } from "../shared/diagnostics.ts";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { readCache, writeCache } from "./cache.js";
import { fetchCodexQuotaStatus } from "./codex.js";
import { fetchOpenCodeGoData } from "./opencode.js";
import { retryNullable } from "./retry.js";
import {
  formatCodexFullDetail,
  formatCodexQuotaStatus,
  formatOpenCodeBalances,
  formatOpenCodeFullDetail,
  formatProviderStatus,
} from "./status.js";
import type {
  CodexQuotaData,
  ExtensionContext,
  OpenCodeGoData,
  UsageQuotaStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_KEY = "quota";
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_INITIAL_DELAY_MS = 5000;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let lastStatus: UsageQuotaStatus | null = null;
let lastCtx: ExtensionContext | null = null;
let poller: ReturnType<typeof setInterval> | null = null;
let logger: ExtensionLogger;

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
      ...failureDetails(error),
    });
  }
}

function publishCombinedStatus(ctx: ExtensionContext, reason: string): void {
  if (!lastStatus) {
    logger.log("status_skipped", { reason });
    return;
  }

  const codexStatus = formatProviderStatus(
    "Codex",
    lastStatus.codexError,
    lastStatus.codex,
    formatCodexQuotaStatus,
    ctx,
  );
  const ocStatus = formatProviderStatus(
    "OC",
    lastStatus.opencodeGoError,
    lastStatus.opencodeGo,
    formatOpenCodeBalances,
    ctx,
  );

  const statusText = `${codexStatus}${ctx.ui.theme.fg("dim", " │ ")}${ocStatus}`;
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
// Refresh orchestration
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

    const [codexData, goData] = await Promise.all([
      retryNullable(() => fetchCodexQuotaStatus(ctx, logger), {
        maxAttempts: FETCH_RETRY_ATTEMPTS,
        initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
      }),
      retryNullable(() => fetchOpenCodeGoData(logger), {
        maxAttempts: FETCH_RETRY_ATTEMPTS,
        initialDelayMs: FETCH_RETRY_INITIAL_DELAY_MS,
      }),
    ]);

    const codex: CodexQuotaData | null = codexData ?? prevCodex;
    const codexError: string | null = codexData ? null : "fetch_failed";

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
      ...failureDetails(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

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
  logger = createExtensionLogger(ctx, "quota");
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
// /quota command
// ---------------------------------------------------------------------------

function formatQuotaFullOutput(): string {
  if (!lastStatus) return "";
  const lines: string[] = [];
  if (lastStatus.codex && !lastStatus.codexError) {
    lines.push(...formatCodexFullDetail(lastStatus.codex));
  }
  if (lastStatus.opencodeGo && !lastStatus.opencodeGoError) {
    lines.push(...formatOpenCodeFullDetail(lastStatus.opencodeGo));
  }
  return lines.join("\n");
}

async function handleQuotaCommand(
  _args: string,
  ctx: ExtensionContext,
): Promise<void> {
  lastCtx = ctx;
  await refreshStatus("quota_command");
  const output = formatQuotaFullOutput();
  if (!output) {
    ctx.ui.notify("No quota data available", "info");
    return;
  }
  ctx.ui.notify(output, "info");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", handleSessionStart);
  pi.on("turn_start", handleTurnStart);
  pi.on("turn_end", handleTurnEnd);
  pi.on("session_shutdown", handleSessionShutdown);

  pi.registerCommand("quota", {
    description: "Show detailed quota information",
    handler: handleQuotaCommand,
  });
}
