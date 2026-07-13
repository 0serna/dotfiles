import { clampPercent } from "./formatting.js";
import { OBSERVATION_RETENTION_MS } from "./snapshot-transitions.js";
import {
  type QuotaSnapshot,
  type SourceIdentity,
  type SourceRecord,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPACT_SEPARATOR = " - ";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColorIntent = "dim" | "warning";

export type CompactStatusOptions = {
  activeSource?: SourceIdentity;
  now?: number;
  /** When provided, each segment is wrapped with the colorizer and joined. */
  colorize?: (intent: ColorIntent, text: string) => string;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function providerLabel(record: SourceRecord): string {
  return record.identity.providerId === "opencode-go"
    ? "OC"
    : record.descriptor.compactPrefix;
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

/** Returns the most-constrained window percentage with its suffix. */
function selectPercent(record: SourceRecord): string | undefined {
  const windows = record.windows;
  if (!windows) return undefined;
  if (windows.rolling)
    return `${clampPercent(windows.rolling.remainingPercent)}%r`;
  if (windows.weekly)
    return `${clampPercent(windows.weekly.remainingPercent)}%w`;
  if (windows.monthly)
    return `${clampPercent(windows.monthly.remainingPercent)}%m`;
  return undefined;
}

function isLow(record: SourceRecord): boolean {
  if (!record.windows) return false;
  return (
    (record.windows.rolling?.remainingPercent ?? 100) <= 10 ||
    (record.windows.weekly?.remainingPercent ?? 100) <= 10 ||
    (record.windows.monthly?.remainingPercent ?? 100) <= 10
  );
}

function bankedResetLabel(record: SourceRecord): string {
  const resets = record.extras?.bankedResets;
  if (!resets) return "";
  if (resets.kind === "available") return `R${resets.details.length}`;
  if (resets.kind === "empty") return "R0";
  return "R?";
}

type CompactSegment = {
  text: string;
  intent: ColorIntent;
};

function formatSourceCompact(
  record: SourceRecord,
  now: number,
): CompactSegment {
  const label = providerLabel(record);

  if (record.state === "refreshing") {
    return { text: `${label} …`, intent: "dim" };
  }

  if (isExhausted(record)) {
    const resets = bankedResetLabel(record);
    return {
      text: `${label} 0%${resets ? ` ${resets}` : ""}`,
      intent: "warning",
    };
  }

  const usable = isUsable(record, now);
  if (!usable) {
    return { text: `${label} error`, intent: "warning" };
  }

  const percent = selectPercent(record);
  const percentLabel = percent ?? "0%";
  const resets = bankedResetLabel(record);
  const degraded = record.state === "degraded";

  const degradedPrefix = degraded ? "⚠ " : "";
  const intent: ColorIntent = degraded || isLow(record) ? "warning" : "dim";

  return {
    text: `${degradedPrefix}${label} ${percentLabel}${resets ? ` ${resets}` : ""}`,
    intent,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the compact quota status from the latest snapshot. Returns a single
 * string suitable for the footer's `quota` status slot.
 *
 * When `colorize` is provided, each segment is individually colored according
 * to its intent (dim or warning). Without it, plain text is returned.
 */
export function formatCompactStatus(
  snapshot: QuotaSnapshot,
  options: CompactStatusOptions = {},
): string {
  const now = options.now ?? Date.now();
  const colorize = options.colorize;
  const records = Object.values(snapshot.sources);

  if (records.length === 0) return " ";

  const grouped = new Map<string, SourceRecord[]>();
  for (const record of records) {
    const prefix = providerLabel(record);
    const list = grouped.get(prefix) ?? [];
    list.push(record);
    grouped.set(prefix, list);
  }

  const usableCount = records.filter((record) => isUsable(record, now)).length;
  const anyRefreshing = records.some((r) => r.state === "refreshing");

  // Global "Quota …" when nothing is usable and the cycle is still in flight.
  if (usableCount === 0 && anyRefreshing) {
    return colorize ? colorize("dim", "Quota …") : "Quota …";
  }

  const segments: CompactSegment[] = [];
  for (const [groupPrefix, group] of grouped) {
    const active = pickActiveSource(group, options.activeSource);
    if (active) {
      segments.push(formatSourceCompact(active, now));
    } else {
      const refreshing = group.find((r) => r.state === "refreshing");
      if (refreshing && usableCount > 0) {
        segments.push({ text: `${groupPrefix} …`, intent: "dim" });
      } else {
        segments.push({ text: `${groupPrefix} error`, intent: "warning" });
      }
    }
  }

  if (colorize) {
    const colored = segments.map((seg) => colorize(seg.intent, seg.text));
    if (colored.length <= 1) return colored.join("");
    const dimSep = colorize("dim", COMPACT_SEPARATOR);
    return colored.join(dimSep);
  }
  return segments.map((seg) => seg.text).join(COMPACT_SEPARATOR);
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
