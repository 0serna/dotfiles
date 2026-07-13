import {
  type BankedResetDetail,
  type QuotaSnapshot,
  type SourceIdentity,
  type SourceRecord,
  type SourceWindow,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DETAIL_WIDTH = 31;
const DETAIL_LABEL_WIDTH = 10;
const DETAIL_VALUE_WIDTH = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

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

function formatResetTime(resetAt: number): string {
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

function formatRelativeExpiry(expiresAt: number): string {
  const remainingSeconds = expiresAt - Math.floor(Date.now() / 1000);
  if (remainingSeconds <= 0) return "expired";
  const days = Math.round(remainingSeconds / 86_400);
  if (days >= 1) {
    return `in ${days}d`;
  }
  const hours = Math.max(1, Math.round(remainingSeconds / 3600));
  return `in ${hours}h`;
}

function formatWindowRow(
  label: string,
  percent: number,
  resetLabel: string,
): string {
  const formattedPercent = String(percent).padStart(DETAIL_VALUE_WIDTH - 1);
  return detailRow(label, `${formattedPercent}% reset ${resetLabel}`);
}

function formatWindowBlock(
  label: string,
  window: SourceWindow | undefined,
): string | undefined {
  if (!window) return undefined;
  return formatWindowRow(
    label,
    clampPercent(window.remainingPercent),
    formatResetTime(window.resetAt),
  );
}

function formatSourceDetail(
  record: SourceRecord,
  options: { isActive: boolean; now: number },
): string {
  const title =
    record.descriptor.displayName + (options.isActive ? " (active)" : "");
  const lines: string[] = [detailBorder(title)];

  if (record.windows) {
    const rolling = formatWindowBlock("Rolling", record.windows.rolling);
    if (rolling) lines.push(rolling);
    const weekly = formatWindowBlock("Weekly", record.windows.weekly);
    if (weekly) lines.push(weekly);
    const monthly = formatWindowBlock("Monthly", record.windows.monthly);
    if (monthly) lines.push(monthly);
  } else {
    lines.push(detailRow("State", record.state));
  }

  if (record.extras?.credits != null) {
    lines.push(detailValueRow("Credits", `${record.extras.credits}`));
  }
  if (record.extras?.balanceDollars != null) {
    lines.push(
      detailValueRow("Balance", `$${record.extras.balanceDollars.toFixed(2)}`),
    );
  }
  if (record.extras?.bankedResets?.kind === "available") {
    const details: BankedResetDetail[] = record.extras.bankedResets.details;
    lines.push(detailValueRow("Resets", `${details.length}`));
    details.forEach((detail, index) => {
      lines.push(
        detailSubRow(`#${index + 1} ${formatRelativeExpiry(detail.expiresAt)}`),
      );
    });
  }

  // Lifecycle row: state, age, reason.
  if (
    record.state === "degraded" ||
    record.state === "expired" ||
    record.state === "unavailable" ||
    record.state === "exhausted"
  ) {
    const age = options.now - record.lastSuccessAt;
    const ageLabel =
      record.lastSuccessAt > 0
        ? `${Math.round(age / 1000)}s ago`
        : "no observation";
    lines.push(detailRow("State", record.state));
    lines.push(detailRow("Age", ageLabel));
    if (record.failure?.message) {
      lines.push(detailSubRow(record.failure.message));
    }
  }

  if (record.configConflict) {
    lines.push(detailSubRow(`config conflict: ${record.configConflict}`));
  }

  lines.push(detailFooter());
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type FormatQuotaDetailOptions = {
  activeSource?: SourceIdentity;
  now?: number;
};

/**
 * Render a detailed projection of the latest snapshot for the `/quota`
 * command. Does not perform any network activity.
 */
export function formatQuotaDetail(
  snapshot: QuotaSnapshot,
  options: FormatQuotaDetailOptions = {},
): string {
  const now = options.now ?? Date.now();
  const records = Object.values(snapshot.sources).sort((a, b) =>
    a.descriptor.displayName.localeCompare(b.descriptor.displayName),
  );
  return records
    .map((record) =>
      formatSourceDetail(record, {
        isActive:
          options.activeSource != null &&
          options.activeSource.providerId === record.identity.providerId &&
          options.activeSource.sourceId === record.identity.sourceId,
        now,
      }),
    )
    .join("\n\n");
}
