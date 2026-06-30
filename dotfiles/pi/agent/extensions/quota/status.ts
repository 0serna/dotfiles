import type {
  CodexQuotaData,
  CodexUsageWindow,
  ExtensionContext,
  OpenCodeGoData,
  WindowLabel,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOW_QUOTA_THRESHOLD_PERCENT = 20;
const STATUS_SEPARATOR = " ";

type ThemeColor = Parameters<ExtensionContext["ui"]["theme"]["fg"]>[0];

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

// ---------------------------------------------------------------------------
// Compact window selection
// ---------------------------------------------------------------------------

type WindowCandidate = {
  label: WindowLabel;
  percent: number;
  resetLabel: string;
  isPrimary: boolean;
};

/**
 * Select which windows to display in compact mode:
 * - Always include the primary window if available.
 * - Include longer windows only when below the low-quota threshold.
 * - If the primary window is missing, fall back to the first available window.
 */
export function selectCompactWindows(
  candidates: WindowCandidate[],
): WindowCandidate[] {
  const primary = candidates.find((c) => c.isPrimary);
  const others = candidates.filter((c) => !c.isPrimary);

  const belowThreshold = others.filter(
    (c) => c.percent < LOW_QUOTA_THRESHOLD_PERCENT,
  );

  if (primary) {
    return [primary, ...belowThreshold];
  }

  // Primary missing: show first available window as fallback
  if (candidates.length > 0) {
    return [candidates[0]!];
  }

  return [];
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
  label: string,
  remainingPercent: number,
  resetLabel: string,
  ctx: ExtensionContext,
  suppressExhaustedWarning = false,
): string {
  const roundedPercent = clampPercent(remainingPercent);
  const segment = `${label}(${roundedPercent}% ${resetLabel})`;
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

function codexWindowCandidates(data: CodexQuotaData): WindowCandidate[] {
  const candidates: WindowCandidate[] = [];

  if (data.remaining5h != null && data.resetAt5h != null) {
    candidates.push({
      label: "R",
      percent: data.remaining5h,
      resetLabel: formatResetTime(data.resetAt5h),
      isPrimary: true,
    });
  }

  if (data.remaining7d != null && data.resetAt7d != null) {
    candidates.push({
      label: "W",
      percent: data.remaining7d,
      resetLabel: formatResetTime(data.resetAt7d),
      isPrimary: false,
    });
  }

  return candidates;
}

export function formatCodexQuotaStatus(
  data: CodexQuotaData,
  ctx: ExtensionContext,
): string | null {
  const candidates = codexWindowCandidates(data);
  if (candidates.length === 0) return null;

  const selected = selectCompactWindows(candidates);
  const windowExhausted = data.remaining5h === 0 || data.remaining7d === 0;
  const consumingCredits =
    hasPositiveBalance(data.remainingCredits) && windowExhausted;
  const belowThreshold = candidates.some(
    (c) => c.percent < LOW_QUOTA_THRESHOLD_PERCENT,
  );

  const parts = selected.map((c) =>
    formatPercentResetSegment(
      c.label,
      c.percent,
      c.resetLabel,
      ctx,
      consumingCredits,
    ),
  );

  if (belowThreshold && data.bankedResetCredits != null) {
    const color = data.bankedResetCredits > 0 ? "accent" : "dim";
    parts.push(formatCountSegment(ctx, "R", data.bankedResetCredits, color));
  }

  if (consumingCredits && data.remainingCredits != null) {
    parts.push(formatCountSegment(ctx, "C", data.remainingCredits, "warning"));
  }

  return joinStatusParts(ctx, parts);
}

// ---------------------------------------------------------------------------
// OpenCode Go formatting
// ---------------------------------------------------------------------------

function formatOpenCodeResetTime(resetInSec: number): string {
  return formatResetTime(Math.floor(Date.now() / 1000) + resetInSec);
}

function openCodeWindowCandidates(data: OpenCodeGoData): WindowCandidate[] {
  const candidates: WindowCandidate[] = [];

  if (data.rolling) {
    candidates.push({
      label: "R",
      percent: clampPercent(data.rolling.remainingPercent),
      resetLabel: formatOpenCodeResetTime(data.rolling.resetInSec),
      isPrimary: true,
    });
  }

  if (data.weekly) {
    candidates.push({
      label: "W",
      percent: clampPercent(data.weekly.remainingPercent),
      resetLabel: formatOpenCodeResetTime(data.weekly.resetInSec),
      isPrimary: false,
    });
  }

  if (data.monthly) {
    candidates.push({
      label: "M",
      percent: clampPercent(data.monthly.remainingPercent),
      resetLabel: formatOpenCodeResetTime(data.monthly.resetInSec),
      isPrimary: false,
    });
  }

  return candidates;
}

export function formatOpenCodeBalances(
  data: OpenCodeGoData,
  ctx: ExtensionContext,
): string | null {
  const candidates = openCodeWindowCandidates(data);
  if (candidates.length === 0) return null;

  const windowExhausted = candidates.some((c) => c.percent === 0);
  const consumingBalance =
    hasPositiveBalance(data.balanceDollars) && windowExhausted;

  const selected = selectCompactWindows(candidates);
  const parts = selected.map((c) =>
    formatPercentResetSegment(
      c.label,
      c.percent,
      c.resetLabel,
      ctx,
      consumingBalance,
    ),
  );

  if (consumingBalance && data.balanceDollars != null) {
    parts.push(formatMoneySegment(ctx, data.balanceDollars, "warning"));
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
