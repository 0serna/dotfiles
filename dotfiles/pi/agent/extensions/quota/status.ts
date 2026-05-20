import type {
  CodexQuotaData,
  CodexUsageWindow,
  ExtensionContext,
  OpenCodeGoData,
  OpenCodeGoWindowData,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOW_QUOTA_THRESHOLD_PERCENT = 20;

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Pure numeric helpers
// ---------------------------------------------------------------------------

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toRemainingPercent(
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

export function parseCredits(
  balance: number | string | undefined,
  unlimited: boolean | undefined,
): number | undefined {
  if (unlimited) return undefined;
  const value = typeof balance === "number" ? balance : Number(balance);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

// ---------------------------------------------------------------------------
// Reset time formatting
// ---------------------------------------------------------------------------

export function formatResetTime(resetAt: number): string {
  const date = new Date(resetAt * 1000);
  const h12 = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${h12}:${minutes}`;

  if (date.toDateString() === new Date().toDateString()) return timeStr;
  const days = Math.max(
    1,
    Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return `${days}d`;
}

export function formatPercentResetSegment(
  remainingPercent: number,
  resetLabel: string,
  ctx: ExtensionContext,
): string {
  const segment = `${remainingPercent}(${resetLabel})`;
  if (remainingPercent < LOW_QUOTA_THRESHOLD_PERCENT) {
    return ctx.ui.theme.fg("mdHeading", segment);
  }
  return ctx.ui.theme.fg("dim", segment);
}

// ---------------------------------------------------------------------------
// Codex status formatting
// ---------------------------------------------------------------------------

export function formatCodexQuotaStatus(
  data: CodexQuotaData,
  ctx: ExtensionContext,
): string | null {
  if (
    data.remaining5h == null ||
    data.resetAt5h == null ||
    data.remaining7d == null ||
    data.resetAt7d == null
  ) {
    return null;
  }

  const parts = [
    formatPercentResetSegment(
      data.remaining5h,
      formatResetTime(data.resetAt5h),
      ctx,
    ),
    formatPercentResetSegment(
      data.remaining7d,
      formatResetTime(data.resetAt7d),
      ctx,
    ),
  ];

  if (data.remainingCredits != null) {
    parts.push(ctx.ui.theme.fg("dim", `C${data.remainingCredits}`));
  }

  return parts.join(ctx.ui.theme.fg("dim", " "));
}

// ---------------------------------------------------------------------------
// OpenCode Go formatting
// ---------------------------------------------------------------------------

export function formatOpenCodeResetTime(resetInSec: number): string {
  return formatResetTime(Math.floor(Date.now() / 1000) + resetInSec);
}

export function formatOpenCodeSegment(
  window: OpenCodeGoWindowData,
  ctx: ExtensionContext,
): string {
  return formatPercentResetSegment(
    window.remainingPercent,
    formatOpenCodeResetTime(window.resetInSec),
    ctx,
  );
}

export function formatOpenCodeBalances(
  data: OpenCodeGoData,
  ctx: ExtensionContext,
): string | null {
  if (!data.rolling || !data.weekly || !data.monthly) return null;

  const parts = [
    formatOpenCodeSegment(data.rolling, ctx),
    formatOpenCodeSegment(data.weekly, ctx),
    formatOpenCodeSegment(data.monthly, ctx),
  ];

  if (data.balanceDollars != null) {
    parts.push(ctx.ui.theme.fg("dim", `$${data.balanceDollars.toFixed(2)}`));
  }

  return parts.join(ctx.ui.theme.fg("dim", " "));
}

// ---------------------------------------------------------------------------
// Provider status composition
// ---------------------------------------------------------------------------

export function formatProviderStatus<T>(
  label: string,
  error: string | null,
  data: T | null,
  formatter: (data: T, ctx: ExtensionContext) => string | null,
  ctx: ExtensionContext,
): string {
  if (error || !data) return ctx.ui.theme.fg("mdHeading", `${label} error`);
  const status = formatter(data, ctx);
  if (!status) return ctx.ui.theme.fg("mdHeading", `${label} error`);
  return `${ctx.ui.theme.fg("dim", `${label} `)}${status}`;
}
