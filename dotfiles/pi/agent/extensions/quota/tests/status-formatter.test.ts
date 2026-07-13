import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceRecord,
} from "../snapshot.js";
import { formatCompactStatus } from "../status-formatter.js";

const CODEX: SourceDescriptor = {
  identity: { providerId: "openai-codex", sourceId: "codex-login" },
  displayName: "Codex",
  compactPrefix: "Codex",
  configFingerprint: "fingerprint:codex:default",
};

const OPENCODE: SourceDescriptor = {
  identity: { providerId: "opencode-go", sourceId: "opencode-go:2" },
  displayName: "OpenCode 2",
  compactPrefix: "OpenCode",
  configFingerprint: "fingerprint:opencode-go:2",
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

describe("formatCompactStatus", () => {
  it("renders 'Codex 80% R2 · OpenCode(2) 75%' for healthy providers", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: {
          bankedResets: { kind: "available", details: [{}, {}] as never },
        },
      }),
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 75, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, {
      activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
    });
    expect(result).toBe("Codex 80% R2 · OpenCode(2) 75%");
  });

  it("renders 0% when any window is exhausted", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 50, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 0, resetAt: NOW_SECONDS + 7200 },
        },
        extras: {
          bankedResets: {
            kind: "available",
            details: [
              {
                expiresAt: NOW_SECONDS + 3600,
                grantedAt: NOW_SECONDS,
                status: "available",
              },
              {
                expiresAt: NOW_SECONDS + 7200,
                grantedAt: NOW_SECONDS,
                status: "available",
              },
            ],
          },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toBe("Codex 0% R2");
  });

  it("renders R0 when reset data is confirmed empty", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "empty" } },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Codex 80% R0");
  });

  it("renders R? when banked reset data is unavailable", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "unavailable" } },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Codex 80% R?");
  });

  it("appends ! for degraded observations within the 30-minute window", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "degraded",
        observedAt: Date.now() - 10 * 60 * 1000,
        lastSuccessAt: Date.now() - 10 * 60 * 1000,
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "available", details: [{}] as never } },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toMatch(/Codex 80% R1!/);
  });

  it("renders 'Provider …' while a provider is refreshing", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "refreshing",
        observedAt: 0,
        lastSuccessAt: 0,
      }),
      makeRecord(OPENCODE, {
        state: "fresh",
        windows: {
          rolling: { remainingPercent: 50, resetAt: NOW_SECONDS + 3600 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, {
      activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
    });
    expect(result).toContain("Provider …");
    expect(result).toContain("OpenCode(2) 50%");
  });

  it("renders 'Quota …' when no usable observation exists", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "refreshing",
        observedAt: 0,
        lastSuccessAt: 0,
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Quota …");
  });

  it("renders 'Provider error' when no usable data remains", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, { state: "unavailable" }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Provider error");
  });

  it("does not include reset times or spendable balances", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: {
          bankedResets: { kind: "available", details: [] },
          credits: 100,
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).not.toContain("100");
    expect(result).not.toContain("13:00");
  });
});
