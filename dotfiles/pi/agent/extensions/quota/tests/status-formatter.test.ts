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

const OPENCODE_ONE: SourceDescriptor = {
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

describe("formatCompactStatus", () => {
  it("renders 'Codex 80r OpenCode 75r' for healthy providers", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
        },
      }),
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 75, resetAt: NOW_SECONDS + 7200 },
          weekly: { remainingPercent: 80, resetAt: NOW_SECONDS + 86400 },
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 172800 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, {
      activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
    });
    expect(result).toBe("Codex 80r OpenCode 75r");
  });

  it("shows only provider prefix, not account name", () => {
    const snapshot = makeSnapshot([
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 75, resetAt: NOW_SECONDS + 7200 },
          weekly: { remainingPercent: 80, resetAt: NOW_SECONDS + 86400 },
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 172800 },
        },
      }),
    ]);
    expect(formatCompactStatus(snapshot)).toBe("OpenCode 75r");
  });

  it("uses r suffix for rolling, w for weekly, m for monthly", () => {
    const rollingOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 60, resetAt: NOW_SECONDS + 3600 },
        },
      }),
    ]);
    expect(formatCompactStatus(rollingOnly)).toBe("Codex 60r");

    const weeklyOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          weekly: { remainingPercent: 70, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    expect(formatCompactStatus(weeklyOnly)).toBe("Codex 70w");

    const monthlyOnly = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    expect(formatCompactStatus(monthlyOnly)).toBe("Codex 90m");
  });

  it("renders the least remaining window", () => {
    const snapshot = makeSnapshot([
      makeRecord(CODEX, {
        windows: {
          rolling: { remainingPercent: 80, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 70, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    expect(formatCompactStatus(snapshot)).toBe("Codex 70w");
  });

  it("renders the active OpenCode account without considering exhausted inactive accounts", () => {
    const snapshot = makeSnapshot([
      makeRecord(OPENCODE_ONE, {
        windows: {
          rolling: { remainingPercent: 90, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 50, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 0, resetAt: NOW_SECONDS + 86400 },
        },
      }),
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 90, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 9, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 27, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    const intents: string[] = [];
    const result = formatCompactStatus(snapshot, {
      activeSource: OPENCODE.identity,
      colorize: (intent, text) => {
        intents.push(intent);
        return text;
      },
    });

    expect(result).toBe("OpenCode 9w");
    expect(intents).toEqual(["dim"]);
  });

  it("renders an exhausted higher-granularity window as zero", () => {
    const snapshot = makeSnapshot([
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 90, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 50, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 0, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);

    expect(formatCompactStatus(snapshot)).toBe("OpenCode 0m");
  });

  it("warns when OpenCode is missing an expected window", () => {
    const snapshot = makeSnapshot([
      makeRecord(OPENCODE, {
        windows: {
          rolling: { remainingPercent: 90, resetAt: NOW_SECONDS + 3600 },
          weekly: { remainingPercent: 50, resetAt: NOW_SECONDS + 7200 },
        },
      }),
    ]);
    const intents: string[] = [];
    const result = formatCompactStatus(snapshot, {
      colorize: (intent, text) => {
        intents.push(intent);
        return text;
      },
    });

    expect(result).toBe("OpenCode incomplete");
    expect(intents).toEqual(["warning"]);
  });

  describe("exhausted window suffixes", () => {
    it("uses r suffix when only rolling is exhausted", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 0, resetAt: NOW_SECONDS + 3600 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0r");
    });

    it("uses w suffix when only weekly is exhausted", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            weekly: { remainingPercent: 0, resetAt: NOW_SECONDS + 7200 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0w");
    });

    it("uses m suffix when only monthly is exhausted", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            monthly: { remainingPercent: 0, resetAt: NOW_SECONDS + 86400 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0m");
    });

    it("uses w suffix when rolling and weekly are both exhausted (higher granularity wins)", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 0, resetAt: NOW_SECONDS + 3600 },
            weekly: { remainingPercent: 0, resetAt: NOW_SECONDS + 7200 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0w");
    });

    it("uses m suffix when rolling and monthly are both exhausted (higher granularity wins)", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 0, resetAt: NOW_SECONDS + 3600 },
            monthly: { remainingPercent: 0, resetAt: NOW_SECONDS + 86400 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0m");
    });

    it("uses m suffix when all three windows are exhausted", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          windows: {
            rolling: { remainingPercent: 0, resetAt: NOW_SECONDS + 3600 },
            weekly: { remainingPercent: 0, resetAt: NOW_SECONDS + 7200 },
            monthly: { remainingPercent: 0, resetAt: NOW_SECONDS + 86400 },
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0m");
    });

    it("shows 0 without suffix when state is exhausted but no windows are present", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          state: "exhausted",
          providerExhaustion: {
            confirmedAt: Date.now(),
            reportedBy: "test",
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0");
    });

    it("shows 0 with suffix when state is exhausted and a window is present at 0%", () => {
      const snapshot = makeSnapshot([
        makeRecord(CODEX, {
          state: "exhausted",
          windows: {
            rolling: { remainingPercent: 0, resetAt: NOW_SECONDS + 3600 },
          },
          providerExhaustion: {
            confirmedAt: Date.now(),
            reportedBy: "test",
          },
        }),
      ]);
      expect(formatCompactStatus(snapshot)).toBe("Codex 0r");
    });
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
    expect(result).toContain("Codex 80r");
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
    expect(result).toContain("Codex 80r");
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
    expect(result).toMatch(/⚠ Codex 80r/);
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
          weekly: { remainingPercent: 80, resetAt: NOW_SECONDS + 7200 },
          monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
        },
      }),
    ]);
    const result = formatCompactStatus(snapshot, {
      activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
    });
    expect(result).toContain("Codex …");
    expect(result).toContain("OpenCode 50r");
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

    it("returns dim for positive low-quota segments", () => {
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
      expect(intents).toEqual(["dim"]);
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
            weekly: { remainingPercent: 80, resetAt: NOW_SECONDS + 7200 },
            monthly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
          },
        }),
      ]);
      const intents: string[] = [];
      formatCompactStatus(snapshot, {
        activeSource: { providerId: "opencode-go", sourceId: "opencode-go:2" },
        colorize: (intent, text) => {
          if (text !== " ") intents.push(intent);
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
            weekly: { remainingPercent: 90, resetAt: NOW_SECONDS + 86400 },
            monthly: { remainingPercent: 100, resetAt: NOW_SECONDS + 172800 },
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
      // Positive low quota remains dim; OpenCode and the separator are also dim.
      expect(calls).toEqual([
        { intent: "dim", text: "Codex 5r" },
        { intent: "dim", text: "OpenCode 80r" },
        { intent: "dim", text: " " },
      ]);
    });
  });
});
