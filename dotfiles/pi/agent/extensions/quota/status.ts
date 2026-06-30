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
const STATUS_SEPARATOR = " ";

type ThemeColor = Parameters<ExtensionContext["ui"]["theme"]["fg"]>[0];

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

function fg(ctx: ExtensionContext, color: ThemeColor, text: string): string {
  return ctx.ui.theme.fg(color, text);
}

function joinStatusParts(ctx: ExtensionContext, parts: string[]): string {
  return parts.join(fg(ctx, "dim", STATUS_SEPARATOR));
}

function hasPositiveBalance(value: number | undefined): boolean {
  return value != null && value > 0;
}

function formatCountSegment(
  ctx: ExtensionContext,
  prefix: string,
  value: number,
  color: ThemeColor,
): string {
  return fg(ctx, color, `${prefix}${value}`);
}

function formatMoneySegment(
  ctx: ExtensionContext,
  value: number,
  color: ThemeColor,
): string {
  return fg(ctx, color, `$${value.toFixed(2)}`);
}

export function formatPercentResetSegment(
  remainingPercent: number,
  resetLabel: string,
  ctx: ExtensionContext,
  suppressExhaustedWarning = false,
): string {
  const roundedPercent = clampPercent(remainingPercent);
  const segment = `${roundedPercent}(${resetLabel})`;
  const color =
    roundedPercent < LOW_QUOTA_THRESHOLD_PERCENT &&
    !(suppressExhaustedWarning && roundedPercent === 0)
      ? "warning"
      : "dim";
  return fg(ctx, color, segment);
}

// ---------------------------------------------------------------------------
// Codex status formatting
// ---------------------------------------------------------------------------

function hasCodexQuotaWindows(
  data: CodexQuotaData,
): data is CodexQuotaData &
  Required<
    Pick<
      CodexQuotaData,
      "remaining5h" | "resetAt5h" | "remaining7d" | "resetAt7d"
    >
  > {
  return (
    data.remaining5h != null &&
    data.resetAt5h != null &&
    data.remaining7d != null &&
    data.resetAt7d != null
  );
}

function isConsumingCredits(data: CodexQuotaData): boolean {
  return (
    hasPositiveBalance(data.remainingCredits) &&
    (data.remaining5h === 0 || data.remaining7d === 0)
  );
}

export function formatCodexQuotaStatus(
  data: CodexQuotaData,
  ctx: ExtensionContext,
): string | null {
  if (!hasCodexQuotaWindows(data)) return null;

  const consumingCredits = isConsumingCredits(data);
  const parts = [
    formatPercentResetSegment(
      data.remaining5h,
      formatResetTime(data.resetAt5h),
      ctx,
      consumingCredits,
    ),
    formatPercentResetSegment(
      data.remaining7d,
      formatResetTime(data.resetAt7d),
      ctx,
      consumingCredits,
    ),
  ];

  if (data.bankedResetCredits != null) {
    const color = data.bankedResetCredits > 0 ? "accent" : "dim";
    parts.push(formatCountSegment(ctx, "R", data.bankedResetCredits, color));
  }

  if (data.remainingCredits != null) {
    const color = consumingCredits ? "warning" : "dim";
    parts.push(formatCountSegment(ctx, "C", data.remainingCredits, color));
  }

  return joinStatusParts(ctx, parts);
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

function openCodeWindows(data: OpenCodeGoData): OpenCodeGoWindowData[] {
  return [data.rolling, data.weekly, data.monthly].filter(
    (window): window is OpenCodeGoWindowData => window != null,
  );
}

function isConsumingOpenCodeBalance(data: OpenCodeGoData): boolean {
  return (
    hasPositiveBalance(data.balanceDollars) &&
    openCodeWindows(data).some(
      (window) => clampPercent(window.remainingPercent) === 0,
    )
  );
}

export function formatOpenCodeBalances(
  data: OpenCodeGoData,
  ctx: ExtensionContext,
): string | null {
  const windows = openCodeWindows(data);
  if (windows.length === 0 && data.balanceDollars == null) return null;

  const consumingBalance = isConsumingOpenCodeBalance(data);
  const parts =
    windows.length === 3
      ? windows.map((window) =>
          formatOpenCodeSegment(window, ctx, consumingBalance),
        )
      : [];

  if (data.balanceDollars != null) {
    const color = consumingBalance ? "warning" : "dim";
    parts.push(formatMoneySegment(ctx, data.balanceDollars, color));
  }

  return parts.length > 0 ? joinStatusParts(ctx, parts) : null;
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
  if (error || !data) return fg(ctx, "warning", `${label} error`);
  const status = formatter(data, ctx);
  if (!status) return fg(ctx, "warning", `${label} error`);
  return `${fg(ctx, "dim", `${label} `)}${status}`;
}
