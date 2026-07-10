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

export function formatRelativeExpiry(expiresAt: number): string {
  const remainingSeconds = expiresAt - Math.floor(Date.now() / 1000);
  if (remainingSeconds <= 0) return "expired";
  const days = Math.round(remainingSeconds / 86_400);
  if (days >= 1) {
    return `in ${days}d`;
  }
  const hours = Math.max(1, Math.round(remainingSeconds / 3600));
  return `in ${hours}h`;
}

function fg(ctx: ExtensionContext, color: ThemeColor, text: string): string {
  return ctx.ui.theme.fg(color, text);
}

function joinStatusParts(parts: string[]): string {
  return parts.join(STATUS_SEPARATOR);
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
 * Select which window to display in compact mode:
 * Priority: monthly exhausted > weekly exhausted > rolling (default).
 * If rolling is missing, fall back to the first available window.
 */
export function selectCompactWindows(
  candidates: WindowCandidate[],
): WindowCandidate[] {
  if (candidates.length === 0) return [];

  const monthly = candidates.find((c) => c.label === "M");
  const weekly = candidates.find((c) => c.label === "W");
  const rolling = candidates.find((c) => c.isPrimary);

  // Exhausted monthly takes highest priority
  if (monthly && monthly.percent === 0) return [monthly];

  // Exhausted weekly takes next priority
  if (weekly && weekly.percent === 0) return [weekly];

  // Default to rolling if available
  if (rolling) return [rolling];

  // Fallback to first available window
  return [candidates[0]!];
}

export function formatPercentResetSegment(
  label: string,
  remainingPercent: number,
  resetLabel: string,
): string {
  const roundedPercent = clampPercent(remainingPercent);
  return label
    ? `${label} ${roundedPercent}% ${resetLabel}`
    : `${roundedPercent}% ${resetLabel}`;
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

export function formatCodexQuotaStatus(data: CodexQuotaData): string | null {
  const candidates = codexWindowCandidates(data);
  if (candidates.length === 0) return null;

  const selected = selectCompactWindows(candidates);
  const selectedWindow = selected[0]!;
  const windowExhausted = selectedWindow.percent === 0;
  if (!windowExhausted) {
    return joinStatusParts(
      selected.map((c) =>
        formatPercentResetSegment("", c.percent, c.resetLabel),
      ),
    );
  }

  const parts = [selectedWindow.resetLabel];

  parts.push(data.remainingCredits == null ? "?" : `C${data.remainingCredits}`);

  if (data.bankedResetDetails != null) {
    const count = data.bankedResetDetails.length;
    parts.push(`R${count}`);
  }

  return joinStatusParts(parts);
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

export function formatOpenCodeBalances(data: OpenCodeGoData): string | null {
  const candidates = openCodeWindowCandidates(data);
  if (candidates.length === 0) return null;

  const selected = selectCompactWindows(candidates);
  const selectedWindow = selected[0]!;
  const windowExhausted = selectedWindow.percent === 0;
  if (!windowExhausted) {
    return joinStatusParts(
      selected.map((c) =>
        formatPercentResetSegment("", c.percent, c.resetLabel),
      ),
    );
  }

  const parts = [selectedWindow.resetLabel];
  parts.push(
    data.balanceDollars == null ? "?" : `$${data.balanceDollars.toFixed(2)}`,
  );

  return joinStatusParts(parts);
}

// ---------------------------------------------------------------------------
// Full detail formatting (/quota command)
// ---------------------------------------------------------------------------

const DETAIL_WIDTH = 31;

function detailBorder(title: string): string {
  const label = ` ${title} `;
  return `┌${label}${"─".repeat(DETAIL_WIDTH - label.length)}┐`;
}

function detailRow(label: string, value: string): string {
  return `│${`${label.padEnd(10)} ${value}`.padEnd(DETAIL_WIDTH)}│`;
}

function detailSubRow(value: string): string {
  return `│${`  ${value}`.padEnd(DETAIL_WIDTH)}│`;
}

function detailFooter(): string {
  return `└${"─".repeat(DETAIL_WIDTH)}┘`;
}

function formatWindowRow(
  label: string,
  percent: number,
  resetLabel: string,
): string {
  return detailRow(label, `${percent}% reset ${resetLabel}`);
}

export function formatCodexFullDetail(data: CodexQuotaData): string[] {
  const lines: string[] = [detailBorder("Codex")];

  const candidates = codexWindowCandidates(data);
  for (const c of candidates) {
    lines.push(
      formatWindowRow(
        c.label === "R" ? "Rolling" : "Weekly",
        c.percent,
        c.resetLabel,
      ),
    );
  }

  if (data.remainingCredits != null) {
    lines.push(detailRow("Credits", `${data.remainingCredits}`));
  }

  if (data.bankedResetDetails != null) {
    const details = data.bankedResetDetails;
    lines.push(detailRow("Resets", `${details.length}`));
    details.forEach((detail, index) => {
      lines.push(
        detailSubRow(`#${index + 1} ${formatRelativeExpiry(detail.expiresAt)}`),
      );
    });
  }

  lines.push(detailFooter());
  return lines;
}

export function formatOpenCodeFullDetail(data: OpenCodeGoData): string[] {
  const lines: string[] = [detailBorder("OpenCode Go")];

  const candidates = openCodeWindowCandidates(data);
  for (const c of candidates) {
    const label =
      c.label === "R" ? "Rolling" : c.label === "W" ? "Weekly" : "Monthly";
    lines.push(formatWindowRow(label, c.percent, c.resetLabel));
  }

  if (data.balanceDollars != null) {
    lines.push(detailRow("Balance", `$${data.balanceDollars.toFixed(2)}`));
  }

  lines.push(detailFooter());
  return lines;
}

// ---------------------------------------------------------------------------
// Provider status composition
// ---------------------------------------------------------------------------

export function codexHasWarning(data: CodexQuotaData): boolean {
  if (data.remaining5h === 0 || data.remaining7d === 0) return true;
  if (data.remaining5h == null && data.remaining7d == null) return true;
  return false;
}

export function openCodeHasWarning(data: OpenCodeGoData): boolean {
  if (data.rolling?.remainingPercent === 0) return true;
  if (data.weekly?.remainingPercent === 0) return true;
  if (data.monthly?.remainingPercent === 0) return true;
  if (!data.rolling && !data.weekly && !data.monthly) return true;
  return false;
}

export function formatProviderStatus<T>(
  label: string,
  error: string | null,
  data: T | null,
  formatter: (data: T) => string | null,
  ctx: ExtensionContext,
  hasWarning: boolean = false,
): string {
  const isWarning = hasWarning || error != null || data == null;
  const color: ThemeColor = isWarning ? "warning" : "dim";
  if (error || !data) return fg(ctx, color, `${label} error`);
  const status = formatter(data);
  if (!status) return fg(ctx, color, `${label} error`);
  return `${fg(ctx, color, `${label} `)}${fg(ctx, color, status)}`;
}
