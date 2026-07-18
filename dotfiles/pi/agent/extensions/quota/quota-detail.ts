import {
  clampPercent,
  detailBorder,
  detailFooter,
  detailRow,
  detailSubRow,
  detailValueRow,
  formatRelativeExpiry,
  formatResetTime,
  formatWindowRow,
} from "./formatting.js";
import {
  type BankedResetDetail,
  type QuotaSnapshot,
  type SourceIdentity,
  type SourceRecord,
  type SourceWindow,
} from "./snapshot.js";

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
  options: { isActive: boolean },
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

  if (record.extras?.bankedResets?.kind === "available") {
    const details: BankedResetDetail[] = record.extras.bankedResets.details;
    lines.push(detailValueRow("Resets", `${details.length}`));
    details.forEach((detail, index) => {
      lines.push(
        detailSubRow(`#${index + 1} ${formatRelativeExpiry(detail.expiresAt)}`),
      );
    });
  }

  if (record.windows && record.state !== "current") {
    lines.push(detailRow("State", record.state));
  }

  lines.push(detailFooter());
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type FormatQuotaDetailOptions = {
  activeSource?: SourceIdentity;
};

/**
 * Render a detailed projection of the latest snapshot for the `/quota`
 * command. Does not perform any network activity.
 */
export function formatQuotaDetail(
  snapshot: QuotaSnapshot,
  options: FormatQuotaDetailOptions = {},
): string {
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
      }),
    )
    .join("\n\n");
}
