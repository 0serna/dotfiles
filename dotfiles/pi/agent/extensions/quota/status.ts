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
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

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
  suppressExhaustedWarning = false,
): string {
  const roundedPercent = clampPercent(remainingPercent);
  const segment = `${roundedPercent}(${resetLabel})`;
  if (
    roundedPercent < LOW_QUOTA_THRESHOLD_PERCENT &&
    !(suppressExhaustedWarning && roundedPercent === 0)
  ) {
    return ctx.ui.theme.fg("warning", segment);
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

  const isConsumingCredits =
    data.remainingCredits != null &&
    data.remainingCredits > 0 &&
    (data.remaining5h === 0 || data.remaining7d === 0);

  const parts = [
    formatPercentResetSegment(
      data.remaining5h,
      formatResetTime(data.resetAt5h),
      ctx,
      isConsumingCredits,
    ),
    formatPercentResetSegment(
      data.remaining7d,
      formatResetTime(data.resetAt7d),
      ctx,
      isConsumingCredits,
    ),
  ];

  if (data.bankedResetCredits != null) {
    const color = data.bankedResetCredits > 0 ? "accent" : "dim";
    parts.push(ctx.ui.theme.fg(color, `R${data.bankedResetCredits}`));
  }

  if (data.remainingCredits != null) {
    const color = isConsumingCredits ? "warning" : "dim";
    parts.push(ctx.ui.theme.fg(color, `C${data.remainingCredits}`));
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
  suppressExhaustedWarning = false,
): string {
  return formatPercentResetSegment(
    window.remainingPercent,
    formatOpenCodeResetTime(window.resetInSec),
    ctx,
    suppressExhaustedWarning,
  );
}

export function formatOpenCodeBalances(
  data: OpenCodeGoData,
  ctx: ExtensionContext,
): string | null {
  if (
    !data.rolling &&
    !data.weekly &&
    !data.monthly &&
    data.balanceDollars == null
  )
    return null;

  const isConsumingBalance =
    data.balanceDollars != null &&
    data.balanceDollars > 0 &&
    [data.rolling, data.weekly, data.monthly].some(
      (window) => window && clampPercent(window.remainingPercent) === 0,
    );

  const parts: string[] = [];

  if (data.rolling && data.weekly && data.monthly) {
    parts.push(
      formatOpenCodeSegment(data.rolling, ctx, isConsumingBalance),
      formatOpenCodeSegment(data.weekly, ctx, isConsumingBalance),
      formatOpenCodeSegment(data.monthly, ctx, isConsumingBalance),
    );
  }

  if (data.balanceDollars != null) {
    const color = isConsumingBalance ? "warning" : "dim";
    parts.push(ctx.ui.theme.fg(color, `$${data.balanceDollars.toFixed(2)}`));
  }

  return parts.length > 0 ? parts.join(ctx.ui.theme.fg("dim", " ")) : null;
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
  if (error || !data) return ctx.ui.theme.fg("warning", `${label} error`);
  const status = formatter(data, ctx);
  if (!status) return ctx.ui.theme.fg("warning", `${label} error`);
  return `${ctx.ui.theme.fg("dim", `${label} `)}${status}`;
}
