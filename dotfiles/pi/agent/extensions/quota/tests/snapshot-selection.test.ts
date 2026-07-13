import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectFromSnapshot } from "../snapshot-selection.js";
import { emptySnapshot } from "../snapshot-store.js";
import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceRecord,
  type SourceWindow,
} from "../snapshot.js";

const NOW_SECONDS = 1_700_000_000;
const NOW_MS = NOW_SECONDS * 1000;

function window(remainingPercent: number, resetAtOffset = 3600): SourceWindow {
  return { remainingPercent, resetAt: NOW_SECONDS + resetAtOffset };
}

function descriptor(name: string): SourceDescriptor {
  return {
    identity: { providerId: "opencode-go", sourceId: `opencode-go:${name}` },
    displayName: `OpenCode ${name}`,
    compactPrefix: "OpenCode",
    configFingerprint: `fingerprint:opencode-go:${name}`,
  };
}

function makeRecord(
  name: string,
  state: SourceRecord["state"],
  rolling: SourceWindow,
  weekly: SourceWindow,
  monthly: SourceWindow,
  observedAt = NOW_MS,
  lastSuccessAt = NOW_MS,
): SourceRecord {
  return {
    identity: { providerId: "opencode-go", sourceId: `opencode-go:${name}` },
    descriptor: descriptor(name),
    state,
    observedAt,
    lastSuccessAt,
    windows: { rolling, weekly, monthly },
  };
}

function snapshotWith(records: SourceRecord[]): QuotaSnapshot {
  const base = emptySnapshot();
  const sources: Record<string, SourceRecord> = {};
  for (const r of records) {
    sources[`${r.identity.providerId}/${r.identity.sourceId}`] = r;
  }
  return { ...base, sources };
}

const accounts = [
  {
    name: "1",
    apiKeyEnv: "KEY_1",
    workspaceEnv: "WS_1",
    cookieEnv: "CK_1",
  },
  {
    name: "2",
    apiKeyEnv: "KEY_2",
    workspaceEnv: "WS_2",
    cookieEnv: "CK_2",
  },
];

const accountStates = accounts.map((account, index) => ({
  name: account.name,
  apiKey: `key-${index + 1}`,
  lastStatus: "untried" as const,
  cooldownUntil: 0,
  failures: 0,
}));

let now = NOW_MS;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  now = NOW_MS;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("selectFromSnapshot", () => {
  it("rejects expired observations", () => {
    const snapshot = snapshotWith([
      makeRecord("1", "expired", window(80), window(80), window(80), 0, 0),
    ]);
    const result = selectFromSnapshot(snapshot, accountStates, accounts, now);
    expect(result).toBe(-1);
  });

  it("rejects provider-confirmed exhausted sources", () => {
    const record = makeRecord("1", "fresh", window(50), window(50), window(50));
    record.providerExhaustion = { confirmedAt: now, reportedBy: "x" };
    const snapshot = snapshotWith([record]);
    const result = selectFromSnapshot(snapshot, accountStates, accounts, now);
    expect(result).toBe(-1);
  });

  it("rejects sources with any window at 0%", () => {
    const snapshot = snapshotWith([
      makeRecord("1", "fresh", window(80), window(0), window(80)),
    ]);
    const result = selectFromSnapshot(snapshot, accountStates, accounts, now);
    expect(result).toBe(-1);
  });

  it("lets a degraded observation compete with a fresh observation", () => {
    const snapshot = snapshotWith([
      makeRecord(
        "1",
        "degraded",
        window(80),
        window(80),
        window(80),
        now - 10 * 60 * 1000,
        now - 10 * 60 * 1000,
      ),
      makeRecord("2", "fresh", window(50), window(50), window(50)),
    ]);
    const result = selectFromSnapshot(snapshot, accountStates, accounts, now);
    // Account 1 (stateIndex 0) wins because it has the higher minimum.
    expect(result).toBe(0);
  });

  it("maximizes the minimum remaining percentage across windows", () => {
    const snapshot = snapshotWith([
      makeRecord("1", "fresh", window(90), window(5), window(90)),
      makeRecord("2", "fresh", window(80), window(80), window(80)),
    ]);
    const result = selectFromSnapshot(snapshot, accountStates, accounts, now);
    expect(result).toBe(1);
  });
});
