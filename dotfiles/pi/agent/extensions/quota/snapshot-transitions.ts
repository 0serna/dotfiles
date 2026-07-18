import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceFailure,
  type SourceIdentity,
  type SourceRecord,
  type SourceWindow,
  sourceKey,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bounded retention window for failed source observations. */
export const OBSERVATION_RETENTION_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SuccessInput = {
  /** Observation timestamp in milliseconds. */
  now: number;
  /** Provider-normalized windows. */
  windows: {
    rolling?: SourceWindow;
    weekly?: SourceWindow;
    monthly?: SourceWindow;
  };
  /** Optional extras (credits, resets, balance). */
  extras?: SourceRecord["extras"];
};

export type FailureInput = {
  /** Failure timestamp in milliseconds. */
  now: number;
  /** Short reason code. */
  reason: string;
  /** Attempt count in the most recent refresh cycle. */
  attempts: number;
  /** Optional human-readable summary. */
  message?: string;
};

export type ExpireInput = {
  /** Current timestamp in milliseconds. */
  now: number;
};

export type ConfigConflictInput = {
  reason: string;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function withSources(
  snapshot: QuotaSnapshot,
  sources: Record<string, SourceRecord>,
  revisionOverride?: number,
): QuotaSnapshot {
  return {
    ...snapshot,
    revision: revisionOverride ?? snapshot.revision + 1,
    sources,
  };
}

function replaceSource(
  snapshot: QuotaSnapshot,
  record: SourceRecord,
): QuotaSnapshot {
  return withSources(snapshot, {
    ...snapshot.sources,
    [sourceKey(record.identity)]: record,
  });
}

/** Validate and load the snapshot's persisted descriptor for a source. */
function findRecord(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
): SourceRecord | undefined {
  return snapshot.sources[sourceKey(identity)];
}

/**
 * Ensure a source record exists for the given descriptor. When the descriptor
 * identity matches an existing record with the same fingerprint, the record is
 * preserved. A changed fingerprint invalidates the prior observation.
 */
export function ensureDescriptor(
  snapshot: QuotaSnapshot,
  descriptor: SourceDescriptor,
): QuotaSnapshot {
  const key = sourceKey(descriptor.identity);
  const existing = snapshot.sources[key];

  if (
    existing &&
    existing.descriptor.configFingerprint === descriptor.configFingerprint
  ) {
    return snapshot;
  }

  const refreshed: SourceRecord = {
    identity: descriptor.identity,
    descriptor,
    state: "unavailable",
    observedAt: 0,
    lastSuccessAt: 0,
  };

  return withSources(snapshot, {
    ...snapshot.sources,
    [key]: refreshed,
  });
}

/**
 * Apply a successful source observation. Always advances the revision and
 * clears the previous failure. Quota exhaustion remains derived from windows.
 */
export function applySourceSuccess(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
  input: SuccessInput,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing) {
    return snapshot;
  }

  const next: SourceRecord = {
    ...existing,
    state: "current",
    observedAt: input.now,
    lastSuccessAt: input.now,
    windows: input.windows,
    extras: input.extras,
    failure: undefined,
    configConflict: undefined,
  };

  return replaceSource(snapshot, next);
}

/**
 * Apply a source-level failure. Preserves the prior observation as `stale`
 * until the 30-minute expiry. A source without a prior observation is
 * `unavailable`. Quota exhaustion remains derived from windows.
 */
export function applySourceFailure(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
  input: FailureInput,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing) {
    return snapshot;
  }

  const hadObservation =
    existing.lastSuccessAt > 0 && existing.windows !== undefined;
  const failure: SourceFailure = {
    reason: input.reason,
    at: input.now,
    attempts: input.attempts,
    message: input.message,
  };

  const next: SourceRecord = {
    ...existing,
    state: hadObservation ? "stale" : "unavailable",
    observedAt: input.now,
    failure,
  };

  return replaceSource(snapshot, next);
}

/**
 * Sweep snapshot sources and make stale observations older than the
 * 30-minute retention window unavailable.
 */
export function expireOldObservations(
  snapshot: QuotaSnapshot,
  input: ExpireInput,
): QuotaSnapshot {
  let changed = false;
  const sources: Record<string, SourceRecord> = {};

  for (const [key, record] of Object.entries(snapshot.sources)) {
    if (record.state !== "stale") {
      sources[key] = record;
      continue;
    }

    const age = input.now - record.lastSuccessAt;
    if (age > OBSERVATION_RETENTION_MS) {
      sources[key] = { ...record, state: "unavailable" };
      changed = true;
    } else {
      sources[key] = record;
    }
  }

  if (!changed) return snapshot;
  return withSources(snapshot, sources);
}

/** True when a source has a usable observation for selection or status. */
export function hasExhaustedQuotaWindow(
  windows: SourceRecord["windows"],
): boolean {
  return Object.values(windows ?? {}).some(
    (window) => window?.remainingPercent === 0,
  );
}

export function isObservationUsable(record: SourceRecord): boolean {
  return (
    record.state !== "unavailable" && !hasExhaustedQuotaWindow(record.windows)
  );
}

/** Record a configuration conflict for a source without overwriting its observation. */
export function recordConfigConflict(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
  input: ConfigConflictInput,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing) return snapshot;

  const next: SourceRecord = {
    ...existing,
    configConflict: input.reason,
  };
  return replaceSource(snapshot, next);
}

/** Detect a configuration conflict between the shared record and a local descriptor. */
export function detectConfigConflict(
  snapshot: QuotaSnapshot,
  descriptor: SourceDescriptor,
): string | undefined {
  const existing = snapshot.sources[sourceKey(descriptor.identity)];
  if (!existing) return undefined;
  if (existing.descriptor.configFingerprint === descriptor.configFingerprint) {
    return undefined;
  }
  return `shared fingerprint "${existing.descriptor.configFingerprint}" disagrees with local "${descriptor.configFingerprint}"`;
}
