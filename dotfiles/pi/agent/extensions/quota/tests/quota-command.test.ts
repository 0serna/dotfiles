import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatQuotaDetail } from "../quota-detail.js";
import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceRecord,
} from "../snapshot.js";
import { stripStyles } from "./helpers.js";

const CODEX: SourceDescriptor = {
  identity: { providerId: "openai-codex", sourceId: "codex-login" },
  displayName: "Codex",
  compactPrefix: "Codex",
  configFingerprint: "fingerprint:codex:default",
};

const OPENCODE_1: SourceDescriptor = {
  identity: { providerId: "opencode-go", sourceId: "opencode-go:1" },
  displayName: "OpenCode 1",
  compactPrefix: "OpenCode",
  configFingerprint: "fingerprint:opencode-go:1",
};

function makeRecord(
  descriptor: SourceDescriptor,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return {
    identity: descriptor.identity,
    descriptor,
    state: "fresh",
    observedAt: 1_000,
    lastSuccessAt: 1_000,
    ...overrides,
  };
}

function makeSnapshot(sources: SourceRecord[]): QuotaSnapshot {
  const map: Record<string, SourceRecord> = {};
  for (const source of sources) {
    map[`${source.identity.providerId}/${source.identity.sourceId}`] = source;
  }
  return {
    version: 1,
    revision: 1,
    cycle: { cycleStartedAt: 0, lastCompletedAt: 1_000 },
    sources: map,
  };
}

const NOW_SECONDS = 1_700_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatQuotaDetail", () => {
  it("renders one block per declared source and marks the active account", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: {
          credits: 100,
          bankedResets: { kind: "available", details: [{}, {}] as never },
        },
      }),
      makeRecord(OPENCODE_1, {
        windows: {
          rolling: { remainingPercent: 50, resetAt: NOW_SECONDS + 7200 },
        },
        extras: { balanceDollars: 12.34 },
      }),
    ]);
    const output = formatQuotaDetail(snapshot, {
      activeSource: OPENCODE_1.identity,
    });
    expect(output).toContain("Codex");
    expect(output).toContain("OpenCode 1 (active)");
    expect(output).toContain("100"); // credits
    expect(output).toContain("$12.34");
  });

  it("marks a degraded source with state, age, and summarized failure", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "degraded",
        observedAt: Date.now() - 10 * 60 * 1000,
        lastSuccessAt: Date.now() - 10 * 60 * 1000,
        windows: {
          rolling: { remainingPercent: 70, resetAt: NOW_SECONDS + 3600 },
        },
        failure: {
          reason: "fetch_failed",
          at: Date.now(),
          attempts: 2,
          message: "network",
        },
      }),
    ]);
    const output = formatQuotaDetail(snapshot, { activeSource: undefined });
    expect(stripStyles(output)).toContain("degraded");
  });

  it("shows 'expired' or 'unavailable' with detailed reason", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "unavailable",
        failure: {
          reason: "config_missing",
          at: Date.now(),
          attempts: 0,
          message: "missing API key",
        },
      }),
    ]);
    const output = stripStyles(
      formatQuotaDetail(snapshot, { activeSource: undefined }),
    );
    expect(output).toContain("unavailable");
    expect(output).toContain("missing API key");
  });

  it("omits fabricated reset credits when banked resets are unavailable", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "unavailable" } },
      }),
    ]);
    const output = formatQuotaDetail(snapshot, { activeSource: undefined });
    expect(stripStyles(output)).not.toContain("Resets 0");
  });
});
