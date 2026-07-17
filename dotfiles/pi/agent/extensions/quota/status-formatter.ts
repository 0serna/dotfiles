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

const COMPACT_SEPARATOR = " ";
const WINDOW_NAMES = ["monthly", "weekly", "rolling"] as const;
const REQUIRED_WINDOWS_BY_PROVIDER: Partial<
  Record<string, readonly WindowName[]>
> = {
  "opencode-go": ["rolling", "weekly", "monthly"],
};

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

type WindowName = (typeof WINDOW_NAMES)[number];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function providerLabel(record: SourceRecord): string {
  return record.descriptor.compactPrefix;
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

/** Returns the highest-granularity exhausted window suffix (monthly > weekly > rolling). */
function exhaustedSuffix(record: SourceRecord): string | undefined {
  const windows = record.windows;
  if (!windows) return undefined;
  if (windows.monthly?.remainingPercent === 0) return "m";
  if (windows.weekly?.remainingPercent === 0) return "w";
  if (windows.rolling?.remainingPercent === 0) return "r";
  return undefined;
}

/** Returns the least remaining window percentage with its suffix. */
function selectPercent(record: SourceRecord): string | undefined {
  const windows = record.windows;
  if (!windows) return undefined;

  let selected: { name: WindowName; remainingPercent: number } | undefined;
  for (const name of WINDOW_NAMES) {
    const window = windows[name];
    if (!window) continue;
    const remainingPercent = clampPercent(window.remainingPercent);
    if (!selected || remainingPercent < selected.remainingPercent) {
      selected = { name, remainingPercent };
    }
  }
  return selected
    ? `${selected.remainingPercent}${selected.name[0]}`
    : undefined;
}

function hasCompleteExpectedWindows(record: SourceRecord): boolean {
  const windows = record.windows;
  if (!windows) return false;
  const required = REQUIRED_WINDOWS_BY_PROVIDER[record.identity.providerId];
  if (required) return required.every((name) => windows[name] != null);

  // Codex can validly report either a rolling or weekly window, but needs one.
  return WINDOW_NAMES.some((name) => windows[name] != null);
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
    const suffix = exhaustedSuffix(record) ?? "";
    return {
      text: `${label} 0${suffix}`,
      intent: "warning",
    };
  }

  const usable = isUsable(record, now);
  if (!usable) {
    return { text: `${label} error`, intent: "warning" };
  }

  if (!hasCompleteExpectedWindows(record)) {
    return { text: `${label} incomplete`, intent: "warning" };
  }

  const percent = selectPercent(record);
  const percentLabel = percent ?? "0";
  const degraded = record.state === "degraded";

  return {
    text: `${degraded ? "⚠ " : ""}${label} ${percentLabel}`,
    intent: degraded ? "warning" : "dim",
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
