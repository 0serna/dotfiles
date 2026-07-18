import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceIdentity,
  type SourceRecord,
  type SourceState,
  type SourceWindow,
} from "../snapshot.js";

const CODEX_IDENTITY: SourceIdentity = {
  providerId: "openai-codex",
  sourceId: "codex-login",
};

const OPENCODE_IDENTITY: SourceIdentity = {
  providerId: "opencode-go",
  sourceId: "opencode-go:1",
};

function makeDescriptor(
  overrides: Partial<SourceDescriptor> = {},
): SourceDescriptor {
  return {
    identity: CODEX_IDENTITY,
    displayName: "Codex",
    compactPrefix: "Codex",
    configFingerprint: "codex:default",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    identity: CODEX_IDENTITY,
    descriptor: makeDescriptor(),
    state: "unavailable",
    observedAt: 1_000,
    lastSuccessAt: 1_000,
    ...overrides,
  };
}

describe("SNAPSHOT_VERSION", () => {
  it("exposes a positive integer version", () => {
    expect(SNAPSHOT_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SNAPSHOT_VERSION)).toBe(true);
  });
});

describe("SourceWindow", () => {
  it("captures remaining percent and an absolute reset timestamp", () => {
    const window: SourceWindow = {
      remainingPercent: 75,
      resetAt: 1_700_000_000,
    };
    expect(window.remainingPercent).toBe(75);
    expect(window.resetAt).toBe(1_700_000_000);
  });
});

describe("SourceState", () => {
  it("covers every lifecycle state", () => {
    const states: SourceState[] = ["current", "stale", "unavailable"];
    expect(new Set(states).size).toBe(states.length);
  });
});

describe("QuotaSnapshot shape", () => {
  it("aggregates cycle metadata and source records", () => {
    const snapshot: QuotaSnapshot = {
      version: SNAPSHOT_VERSION,
      revision: 7,
      cycle: { cycleStartedAt: 1_000, lastCompletedAt: 1_500 },
      sources: {
        [sourceKey(CODEX_IDENTITY)]: makeRecord(),
        [sourceKey(OPENCODE_IDENTITY)]: makeRecord({
          identity: OPENCODE_IDENTITY,
          descriptor: makeDescriptor({
            identity: OPENCODE_IDENTITY,
            displayName: "OpenCode 1",
            compactPrefix: "OpenCode",
          }),
          state: "current",
          observedAt: 1_400,
          lastSuccessAt: 1_400,
        }),
      },
    };

    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.revision).toBe(7);
    expect(Object.keys(snapshot.sources)).toHaveLength(2);
  });
});

function sourceKey(identity: SourceIdentity): string {
  return `${identity.providerId}/${identity.sourceId}`;
}
