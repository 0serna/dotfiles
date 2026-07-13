// ---------------------------------------------------------------------------
// Shared formatting utilities for quota detail and compact status
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pure numeric helpers
// ---------------------------------------------------------------------------

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

export function formatResetTime(resetAt: number): string {
  const date = new Date(resetAt * 1000);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeStr;
  const days = Math.max(
    1,
    Math.round((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
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

// ---------------------------------------------------------------------------
// Box-drawing detail layout
// ---------------------------------------------------------------------------

export const DETAIL_WIDTH = 31;
export const DETAIL_LABEL_WIDTH = 10;
export const DETAIL_VALUE_WIDTH = 5;

export function detailBorder(title: string): string {
  const label = ` ${title} `;
  return `┌${label}${"─".repeat(DETAIL_WIDTH - label.length)}┐`;
}

export function detailRow(label: string, value: string): string {
  return `│${`${label.padEnd(DETAIL_LABEL_WIDTH)} ${value}`.padEnd(DETAIL_WIDTH)}│`;
}

export function detailValueRow(label: string, value: string): string {
  return detailRow(label, value.padStart(DETAIL_VALUE_WIDTH));
}

export function detailSubRow(value: string): string {
  return `│${`  ${value}`.padEnd(DETAIL_WIDTH)}│`;
}

export function detailFooter(): string {
  return `└${"─".repeat(DETAIL_WIDTH)}┘`;
}

export function formatWindowRow(
  label: string,
  percent: number,
  resetLabel: string,
): string {
  const formattedPercent = String(percent).padStart(DETAIL_VALUE_WIDTH - 1);
  return detailRow(label, `${formattedPercent}% reset ${resetLabel}`);
}
