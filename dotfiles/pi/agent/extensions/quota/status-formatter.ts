import { OBSERVATION_RETENTION_MS } from "./snapshot-transitions.js";
import {
  type QuotaSnapshot,
  type SourceIdentity,
  type SourceRecord,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPACT_SEPARATOR = " · ";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompactStatusOptions = {
  activeSource?: SourceIdentity;
  now?: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isExhausted(record: SourceRecord): boolean {
  if (record.state === "exhausted") return true;
  const windows = record.windows;
  if (!windows) return false;
  return (
    (windows.rolling?.remainingPercent ?? 100) === 0 ||
    (windows.weekly?.remainingPercent ?? 100) === 0 ||
    (windows.monthly?.remainingPercent ?? 100) === 0
  );
}

function isUsable(record: SourceRecord, now: number): boolean {
  if (
    record.state === "refreshing" ||
    record.state === "expired" ||
    record.state === "unavailable"
  ) {
    return false;
  }
  if (record.providerExhaustion) return false;
  if (record.state === "degraded") {
    return now - record.lastSuccessAt <= OBSERVATION_RETENTION_MS;
  }
  return true;
}

function selectPercent(record: SourceRecord): number | undefined {
  const windows = record.windows;
  if (!windows) return undefined;
  const rolling = windows.rolling?.remainingPercent;
  const weekly = windows.weekly?.remainingPercent;
  const monthly = windows.monthly?.remainingPercent;
  if (rolling != null) return clampPercent(rolling);
  if (weekly != null) return clampPercent(weekly);
  if (monthly != null) return clampPercent(monthly);
  return undefined;
}

function bankedResetLabel(record: SourceRecord): string {
  const resets = record.extras?.bankedResets;
  if (!resets) return "";
  if (resets.kind === "available") return `R${resets.details.length}`;
  if (resets.kind === "empty") return "R0";
  return "R?";
}

function formatSourceCompact(
  record: SourceRecord,
  active: boolean,
  now: number,
): string {
  const prefix = record.descriptor.compactPrefix;
  const account = record.descriptor.identity.sourceId.startsWith(prefix)
    ? record.descriptor.identity.sourceId
        .slice(prefix.length)
        .replace(/^[:-]/, "")
    : record.descriptor.displayName.replace(prefix, "").trim();

  if (record.state === "refreshing") {
    return `${prefix} ${active ? `(${account}) ` : ""}…`.trim();
  }

  if (isExhausted(record)) {
    const label = account ? `${prefix}(${account}) 0%` : `${prefix} 0%`;
    const resets = bankedResetLabel(record);
    return `${label}${resets ? ` ${resets}` : ""}`;
  }

  const usable = isUsable(record, now);
  if (!usable) {
    return `${prefix} error`;
  }

  const percent = selectPercent(record);
  const percentLabel = percent == null ? "0%" : `${percent}%`;
  const resets = bankedResetLabel(record);
  const degraded = record.state === "degraded" ? "!" : "";
  const labelStart = account ? `${prefix}(${account})` : prefix;
  return `${labelStart} ${percentLabel}${resets ? ` ${resets}` : ""}${degraded}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the compact quota status from the latest snapshot. Returns a single
 * string suitable for the footer's `quota` status slot.
 */
export function formatCompactStatus(
  snapshot: QuotaSnapshot,
  options: CompactStatusOptions = {},
): string {
  const now = options.now ?? Date.now();
  const records = Object.values(snapshot.sources);

  if (records.length === 0) return " ";

  const grouped = new Map<string, SourceRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.descriptor.compactPrefix) ?? [];
    list.push(record);
    grouped.set(record.descriptor.compactPrefix, list);
  }

  const usableCount = records.filter((record) => isUsable(record, now)).length;
  const anyRefreshing = records.some((r) => r.state === "refreshing");

  // Global "Quota …" when nothing is usable and the cycle is still in flight.
  if (usableCount === 0 && anyRefreshing) {
    return "Quota …";
  }

  const parts: string[] = [];
  for (const [, group] of grouped) {
    const active = pickActiveSource(group, options.activeSource);
    if (active) {
      parts.push(formatSourceCompact(active, true, now));
    } else {
      const refreshing = group.find((r) => r.state === "refreshing");
      if (refreshing && usableCount > 0) {
        parts.push(`Provider …`);
      } else {
        parts.push("Provider error");
      }
    }
  }

  return parts.join(COMPACT_SEPARATOR);
}

function pickActiveSource(
  records: SourceRecord[],
  activeSource: SourceIdentity | undefined,
): SourceRecord | undefined {
  if (activeSource) {
    const match = records.find(
      (record) =>
        record.identity.providerId === activeSource.providerId &&
        record.identity.sourceId === activeSource.sourceId,
    );
    if (match) return match;
  }
  // Default: pick the freshest usable record for that prefix.
  const usable = records
    .filter(
      (record) =>
        record.state !== "unavailable" && record.state !== "refreshing",
    )
    .sort((a, b) => b.lastSuccessAt - a.lastSuccessAt);
  return usable[0];
}
