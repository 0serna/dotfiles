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
  it("renders 'Codex 80%r · OpenCode 75%r' for healthy providers", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
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
    expect(result).toBe("Codex 80%r · OpenCode 75%r");
  });

  it("shows only provider prefix, not account name", () => {
    const snapshot = makeSnapshot([
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 75, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    expect(formatCompactStatus(snapshot)).toBe("OpenCode 75%r");
  });

  it("uses %r suffix for rolling, %w for weekly, %m for monthly", () => {
    const rollingOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 60, resetAt: NOW_SECONDS + 3600 },
        },
      }),
    ]);
    expect(formatCompactStatus(rollingOnly)).toBe("Codex 60%r");

    const weeklyOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          weekly: { remainingPercent: 70, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    expect(formatCompactStatus(weeklyOnly)).toBe("Codex 70%w");

    const monthlyOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    expect(formatCompactStatus(monthlyOnly)).toBe("Codex 90%m");
  });

  it("prefers rolling over weekly over monthly", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 70, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    expect(formatCompactStatus(snapshot)).toBe("Codex 80%r");
  });

  it("renders 0% when any window is exhausted", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 50, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 0, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toBe("Codex 0%");
  });

  it("renders 80% without reset when banked resets are confirmed empty", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "empty" } },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Codex 80%r");
    expect(result).not.toContain("R");
  });

  it("renders 80% without reset when banked resets are unavailable", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
        extras: { bankedResets: { kind: "unavailable" } },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Codex 80%r");
    expect(result).not.toContain("R?");
  });

  it("uses ⚠ prefix for degraded observations within the 30-minute window", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        state: "degraded",
        observedAt: Date.now() - 10 * 60 * 1000,
        lastSuccessAt: Date.now() - 10 * 60 * 1000,
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toMatch(/⚠ Codex 80%r/);
  });

  it("uses real provider prefix instead of generic 'Provider' placeholder", () => {
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
    expect(result).toContain("Codex …");
    expect(result).toContain("OpenCode 50%r");
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

  it("renders '<prefix> error' when no usable data remains", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, { state: "unavailable" }),
    ]);
    const result = formatCompactStatus(snapshot, { activeSource: undefined });
    expect(result).toContain("Codex error");
  });

  it("does not include reset times, spendable balances, or banked reset counts", () => {
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
    expect(result).not.toContain("R");
  });

  describe("color intents", () => {
    it("returns dim for healthy segments above 10%", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
          },
        }),
      ]);
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: undefined,
        colorize: (intent, text) => {
          intents.push(intent);
          return text;
        },
      });
      expect(intents).toEqual(["dim"]);
    });

    it("returns warning for segments below 10%", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 5, resetAt: NOW_SECONDS + 3600 },
          },
        }),
      ]);
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: undefined,
        colorize: (intent, text) => {
          intents.push(intent);
          return text;
        },
      });
      expect(intents).toEqual(["warning"]);
    });

    it("returns warning for degraded segments", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          state: "degraded",
          observedAt: Date.now() - 10 * 60 * 1000,
          lastSuccessAt: Date.now() - 10 * 60 * 1000,
          windows: {
            rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
          },
        }),
      ]);
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: undefined,
        colorize: (intent, text) => {
          intents.push(intent);
          return text;
        },
      });
      expect(intents).toEqual(["warning"]);
    });

    it("returns warning for error segments", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, { state: "unavailable" }),
      ]);
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: undefined,
        colorize: (intent, text) => {
          intents.push(intent);
          return text;
        },
      });
      expect(intents).toEqual(["warning"]);
    });

    it("returns dim for refreshing placeholders", () => {
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
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
        colorize: (intent, text) => {
          if (text !== " · ") intents.push(intent);
          return text;
        },
      });
      // Codex refrescando → dim, OpenCode healthy → dim
      expect(intents).toEqual(["dim", "dim"]);
    });

    it("mixes dim and warning intents across providers with dim separator", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 5, resetAt: NOW_SECONDS + 3600 },
          },
        }),
        makeRecord(OPENCODE, {
          windows: {
            rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 7200 },
          },
        }),
      ]);
      const calls: { intent: string; text: string }[] = [];
      formatCompactStatus(snapshot, {
        activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
        colorize: (intent, text) => {
          calls.push({ intent, text });
          return text;
        },
      });
      // Codex <10% → warning, OpenCode → dim, separator → dim
      expect(calls).toEqual([
        { intent: "warning", text: "Codex 5%r" },
        { intent: "dim", text: "OpenCode 80%r" },
        { intent: "dim", text: " · " },
      ]);
    });
  });
});
