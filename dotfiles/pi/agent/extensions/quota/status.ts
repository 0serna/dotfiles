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

// ---------------------------------------------------------------------------
// Window candidate types and helpers
// ---------------------------------------------------------------------------

type WindowCandidate = {
  label: "R" | "W" | "M";
  percent: number;
  resetLabel: string;
};

function codexWindowCandidates(data: CodexQuotaData): WindowCandidate[] {
  const candidates: WindowCandidate[] = [];

  if (data.remaining5h != null && data.resetAt5h != null) {
    candidates.push({
      label: "R",
      percent: data.remaining5h,
      resetLabel: formatResetTime(data.resetAt5h),
    });
  }

  if (data.remaining7d != null && data.resetAt7d != null) {
    candidates.push({
      label: "W",
      percent: data.remaining7d,
      resetLabel: formatResetTime(data.resetAt7d),
    });
  }

  return candidates;
}

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
    });
  }

  if (data.weekly) {
    candidates.push({
      label: "W",
      percent: clampPercent(data.weekly.remainingPercent),
      resetLabel: formatOpenCodeResetTime(data.weekly.resetInSec),
    });
  }

  if (data.monthly) {
    candidates.push({
      label: "M",
      percent: clampPercent(data.monthly.remainingPercent),
      resetLabel: formatOpenCodeResetTime(data.monthly.resetInSec),
    });
  }

  return candidates;
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

export function formatOpenCodeFullDetail(
  data: OpenCodeGoData,
  accountName?: string,
): string[] {
  const title = accountName ? `OpenCode ${accountName}` : "OpenCode Go";
  const lines: string[] = [detailBorder(title)];

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
