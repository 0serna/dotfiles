import { describe, expect, it } from "vitest";
import {
  applySourceFailure,
  applySourceSuccess,
  detectConfigConflict,
  ensureDescriptor,
  expireOldObservations,
  isObservationUsable,
  recordConfigConflict,
} from "../snapshot-transitions.js";
import {
  SNAPSHOT_VERSION,
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceIdentity,
  type SourceRecord,
  type SourceWindow,
} from "../snapshot.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CODEX_IDENTITY: SourceIdentity = {
  providerId: "openai-codex",
  sourceId: "codex-login",
};

function descriptor(
  overrides: Partial<SourceDescriptor> = {},
): SourceDescriptor {
  return {
    identity: CODEX_IDENTITY,
    displayName: "Codex",
    compactPrefix: "Codex",
    configFingerprint: "fingerprint:codex:default",
    ...overrides,
  };
}

function record(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    identity: CODEX_IDENTITY,
    descriptor: descriptor(),
    state: "refreshing",
    observedAt: 0,
    lastSuccessAt: 0,
    ...overrides,
  };
}

function snapshot(overrides: Partial<QuotaSnapshot> = {}): QuotaSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    revision: 1,
    cycle: { cycleStartedAt: 0 },
    sources: {},
    ...overrides,
  };
}

function window(remainingPercent: number, resetAt: number): SourceWindow {
  return { remainingPercent, resetAt };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ensureDescriptor", () => {
  it("inserts a refreshing record when the source is new", () => {
    const next = ensureDescriptor(
      snapshot(),
      descriptor({ configFingerprint: "fingerprint:codex:default" }),
    );
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("refreshing");
    expect(next.revision).toBe(2);
  });

  it("preserves the previous observation when the descriptor fingerprint matches", () => {
    const existing = record({
      state: "fresh",
      lastSuccessAt: 1_000,
      observedAt: 1_000,
      windows: { rolling: window(80, 1_700_000_000) },
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]: existing,
      },
      revision: 4,
    });
    const next = ensureDescriptor(base, descriptor());
    expect(next.sources).toEqual(base.sources);
    expect(next.revision).toBe(4);
  });

  it("invalidates the previous observation when the fingerprint changes", () => {
    const existing = record({
      state: "fresh",
      lastSuccessAt: 1_000,
      observedAt: 1_000,
      windows: { rolling: window(80, 1_700_000_000) },
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]: existing,
      },
    });
    const next = ensureDescriptor(
      base,
      descriptor({ configFingerprint: "fingerprint:codex:rotated" }),
    );
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("refreshing");
    expect(next.sources[key]?.windows).toBeUndefined();
    expect(next.revision).toBe(2);
  });
});

describe("applySourceSuccess", () => {
  it("publishes a fresh observation with normalized windows", () => {
    const sourceRecord = record({ state: "refreshing" });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const now = 2_000;
    const windows = { rolling: window(80, 1_700_000_000) };
    const next = applySourceSuccess(base, CODEX_IDENTITY, {
      now,
      windows,
    });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("fresh");
    expect(next.sources[key]?.observedAt).toBe(now);
    expect(next.sources[key]?.lastSuccessAt).toBe(now);
    expect(next.sources[key]?.windows).toEqual(windows);
    expect(next.sources[key]?.failure).toBeUndefined();
  });

  it("clears provider-confirmed exhaustion on a positive observation", () => {
    const sourceRecord = record({
      state: "exhausted",
      providerExhaustion: { confirmedAt: 500, reportedBy: "other" },
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = applySourceSuccess(base, CODEX_IDENTITY, {
      now: 1_000,
      windows: { rolling: window(50, 1_700_000_000) },
    });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("fresh");
    expect(next.sources[key]?.providerExhaustion).toBeUndefined();
  });
});

describe("applySourceFailure", () => {
  it("preserves the last observation and marks the source degraded when fresh", () => {
    const sourceRecord = record({
      state: "fresh",
      observedAt: 500,
      lastSuccessAt: 500,
      windows: { rolling: window(60, 1_700_000_000) },
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const now = 1_000;
    const next = applySourceFailure(base, CODEX_IDENTITY, {
      now,
      reason: "fetch_failed",
      attempts: 2,
      message: "network",
    });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("degraded");
    expect(next.sources[key]?.windows).toEqual(sourceRecord.windows);
    expect(next.sources[key]?.failure).toEqual({
      reason: "fetch_failed",
      at: now,
      attempts: 2,
      message: "network",
    });
  });

  it("marks the source unavailable when there is no prior observation", () => {
    const sourceRecord = record({ state: "refreshing" });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = applySourceFailure(base, CODEX_IDENTITY, {
      now: 1_000,
      reason: "config_missing",
      attempts: 0,
      message: "missing API key",
    });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("unavailable");
    expect(next.sources[key]?.failure?.message).toBe("missing API key");
  });
});

describe("expireOldObservations", () => {
  it("promotes a degraded source older than 30 minutes to expired", () => {
    const now = 31 * 60 * 1000 + 1_000;
    const sourceRecord = record({
      state: "degraded",
      observedAt: now - 1_000,
      lastSuccessAt: 0,
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = expireOldObservations(base, { now });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("expired");
  });

  it("keeps degraded observations that are still within the 30-minute window", () => {
    const now = 1_000;
    const sourceRecord = record({
      state: "degraded",
      observedAt: now - 10 * 60 * 1000,
      lastSuccessAt: 0,
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = expireOldObservations(base, { now });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("degraded");
  });

  it("does not expire fresh observations", () => {
    const sourceRecord = record({ state: "fresh", lastSuccessAt: 1_000 });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = expireOldObservations(base, { now: 10_000_000 });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("fresh");
  });
});

describe("isObservationUsable", () => {
  it("rejects expired, unavailable, and exhausted sources", () => {
    expect(isObservationUsable(record({ state: "expired" }))).toBe(false);
    expect(isObservationUsable(record({ state: "unavailable" }))).toBe(false);
    expect(
      isObservationUsable(
        record({
          state: "fresh",
          providerExhaustion: { confirmedAt: 1, reportedBy: "x" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts fresh and degraded observations", () => {
    expect(isObservationUsable(record({ state: "fresh" }))).toBe(true);
    expect(isObservationUsable(record({ state: "degraded" }))).toBe(true);
  });
});

describe("configuration conflict handling", () => {
  it("records a conflict without overwriting a valid observation", () => {
    const sourceRecord = record({
      state: "fresh",
      lastSuccessAt: 1_000,
      observedAt: 1_000,
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const next = recordConfigConflict(base, CODEX_IDENTITY, {
      reason: "local credentials missing",
    });
    const key = `${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`;
    expect(next.sources[key]?.state).toBe("fresh");
    expect(next.sources[key]?.configConflict).toBe("local credentials missing");
  });
});

describe("detectConfigConflict", () => {
  it("returns the descriptor fingerprint that disagrees with the shared record", () => {
    const sourceRecord = record({
      descriptor: descriptor({ configFingerprint: "fingerprint:codex:remote" }),
    });
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    const local = descriptor({ configFingerprint: "fingerprint:codex:local" });
    const conflict = detectConfigConflict(base, local);
    expect(conflict).toContain("fingerprint:codex:remote");
    expect(conflict).toContain("fingerprint:codex:local");
  });

  it("returns undefined when fingerprints match", () => {
    const sourceRecord = record();
    const base = snapshot({
      sources: {
        [`${CODEX_IDENTITY.providerId}/${CODEX_IDENTITY.sourceId}`]:
          sourceRecord,
      },
    });
    expect(detectConfigConflict(base, descriptor())).toBeUndefined();
  });
});
