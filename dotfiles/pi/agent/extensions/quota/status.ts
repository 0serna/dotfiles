import type {
  CodexQuotaData,
  CodexUsageWindow,
  OpenCodeGoData,
} from "./types.js";

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

function formatOpenCodeResetTime(resetInSec: number): string {
  return formatResetTime(Math.floor(Date.now() / 1000) + resetInSec);
}

// ---------------------------------------------------------------------------
// Full detail formatting (/quota command)
// ---------------------------------------------------------------------------

const DETAIL_WIDTH = 31;
const DETAIL_LABEL_WIDTH = 10;
const DETAIL_VALUE_WIDTH = 5;

function detailBorder(title: string): string {
  const label = ` ${title} `;
  return `┌${label}${"─".repeat(DETAIL_WIDTH - label.length)}┐`;
}

function detailRow(label: string, value: string): string {
  return `│${`${label.padEnd(DETAIL_LABEL_WIDTH)} ${value}`.padEnd(DETAIL_WIDTH)}│`;
}

function detailValueRow(label: string, value: string): string {
  return detailRow(label, value.padStart(DETAIL_VALUE_WIDTH));
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
  const formattedPercent = String(percent).padStart(DETAIL_VALUE_WIDTH - 1);
  return detailRow(label, `${formattedPercent}% reset ${resetLabel}`);
}

export function formatCodexFullDetail(data: CodexQuotaData): string[] {
  const lines: string[] = [detailBorder("Codex")];

  if (data.remaining5h != null && data.resetAt5h != null) {
    lines.push(
      formatWindowRow(
        "Rolling",
        data.remaining5h,
        formatResetTime(data.resetAt5h),
      ),
    );
  }

  if (data.remaining7d != null && data.resetAt7d != null) {
    lines.push(
      formatWindowRow(
        "Weekly",
        data.remaining7d,
        formatResetTime(data.resetAt7d),
      ),
    );
  }

  if (data.remainingCredits != null) {
    lines.push(detailValueRow("Credits", `${data.remainingCredits}`));
  }

  if (data.bankedResetDetails != null) {
    const details = data.bankedResetDetails;
    lines.push(detailValueRow("Resets", `${details.length}`));
    details.forEach((detail, index) => {
      lines.push(
        detailSubRow(`#${index + 1} ${formatRelativeExpiry(detail.expiresAt)}`),
      );
    });
  }

  lines.push(detailFooter());
  return lines;
}

export function formatOpenCodeFullDetail(
  data: OpenCodeGoData,
  accountName?: string,
  isActive?: boolean,
): string[] {
  const title = accountName
    ? `OpenCode ${accountName}${isActive ? " (active)" : ""}`
    : "OpenCode Go";
  const lines: string[] = [detailBorder(title)];

  if (data.rolling) {
    lines.push(
      formatWindowRow(
        "Rolling",
        clampPercent(data.rolling.remainingPercent),
        formatOpenCodeResetTime(data.rolling.resetInSec),
      ),
    );
  }

  if (data.weekly) {
    lines.push(
      formatWindowRow(
        "Weekly",
        clampPercent(data.weekly.remainingPercent),
        formatOpenCodeResetTime(data.weekly.resetInSec),
      ),
    );
  }

  if (data.monthly) {
    lines.push(
      formatWindowRow(
        "Monthly",
        clampPercent(data.monthly.remainingPercent),
        formatOpenCodeResetTime(data.monthly.resetInSec),
      ),
    );
  }

  if (data.balanceDollars != null) {
    lines.push(detailValueRow("Balance", `$${data.balanceDollars.toFixed(2)}`));
  }

  lines.push(detailFooter());
  return lines;
}
