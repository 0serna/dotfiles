import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceExhaustion,
  type SourceFailure,
  type SourceIdentity,
  type SourceRecord,
  type SourceState,
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

export type SnapshotMerger = (
  current: QuotaSnapshot,
  descriptor: SourceDescriptor,
) => QuotaSnapshot;

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
  /** Optional exhaustion reported alongside a positive observation. */
  providerExhaustion?: SourceExhaustion;
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

/** Advance the snapshot revision by one, returning a new snapshot. */
export function incrementRevision(snapshot: QuotaSnapshot): QuotaSnapshot {
  return { ...snapshot, revision: snapshot.revision + 1 };
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
    state: "refreshing",
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
 * clears the previous failure. Provider-confirmed exhaustion is reconciled
 * with the new positive observation.
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
    state: "fresh",
    observedAt: input.now,
    lastSuccessAt: input.now,
    windows: input.windows,
    extras: input.extras,
    failure: undefined,
    providerExhaustion: input.providerExhaustion,
    configConflict: undefined,
  };

  return replaceSource(snapshot, next);
}

/**
 * Apply a source-level failure. Preserves the prior observation if available
 * and marks the source `degraded` until the 30-minute expiry. A source with
 * no prior observation becomes `unavailable`.
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
    state: hadObservation ? "degraded" : "unavailable",
    observedAt: input.now,
    failure,
  };

  return replaceSource(snapshot, next);
}

/**
 * Sweep snapshot sources and promote any degraded observation older than the
 * 30-minute retention window to `expired`.
 */
export function expireOldObservations(
  snapshot: QuotaSnapshot,
  input: ExpireInput,
): QuotaSnapshot {
  let changed = false;
  const sources: Record<string, SourceRecord> = {};

  for (const [key, record] of Object.entries(snapshot.sources)) {
    if (record.state !== "degraded") {
      sources[key] = record;
      continue;
    }

    const age = input.now - record.lastSuccessAt;
    if (age > OBSERVATION_RETENTION_MS) {
      sources[key] = { ...record, state: "expired" };
      changed = true;
    } else {
      sources[key] = record;
    }
  }

  if (!changed) return snapshot;
  return withSources(snapshot, sources);
}

/** True when a source has a usable observation for selection or status. */
export function isObservationUsable(record: SourceRecord): boolean {
  if (
    record.state === "expired" ||
    record.state === "unavailable" ||
    record.state === "exhausted"
  ) {
    return false;
  }
  if (record.providerExhaustion) return false;
  return true;
}

/** Explicitly clear provider-confirmed exhaustion for a source. */
export function clearExhaustion(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing || !existing.providerExhaustion) {
    return snapshot;
  }

  const next: SourceRecord = {
    ...existing,
    providerExhaustion: undefined,
    state: existing.windows
      ? existing.state === "exhausted"
        ? "fresh"
        : existing.state
      : "refreshing",
  };

  return replaceSource(snapshot, next);
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

/** Remove any previously recorded configuration conflict. */
export function clearConfigConflict(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing || !existing.configConflict) return snapshot;
  const next: SourceRecord = { ...existing, configConflict: undefined };
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

/** Mark a source as provider-confirmed exhausted. */
export function markExhausted(
  snapshot: QuotaSnapshot,
  identity: SourceIdentity,
  exhaustion: SourceExhaustion,
): QuotaSnapshot {
  const existing = findRecord(snapshot, identity);
  if (!existing) return snapshot;
  const next: SourceRecord = {
    ...existing,
    state: "exhausted" as SourceState,
    providerExhaustion: exhaustion,
  };
  return replaceSource(snapshot, next);
}
