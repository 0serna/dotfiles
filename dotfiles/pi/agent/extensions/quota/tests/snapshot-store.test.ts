import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSnapshotStore,
  emptySnapshot,
  quotaStateDir,
  readSnapshotFile,
} from "../snapshot-store.js";
import {
  SNAPSHOT_VERSION,
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceRecord,
} from "../snapshot.js";

const CODEX: SourceDescriptor = {
  identity: { providerId: "openai-codex", sourceId: "codex-login" },
  displayName: "Codex",
  compactPrefix: "Codex",
  configFingerprint: "fingerprint:codex:default",
};

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "quota-store-"));
}

function makeSnapshot(overrides: Partial<QuotaSnapshot> = {}): QuotaSnapshot {
  return {
    ...emptySnapshot(),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    identity: CODEX.identity,
    descriptor: CODEX,
    state: "fresh",
    observedAt: 1_000,
    lastSuccessAt: 1_000,
    ...overrides,
  };
}

describe("quotaStateDir", () => {
  it("returns XDG_STATE_HOME/pi/quota when XDG_STATE_HOME is set", () => {
    expect(quotaStateDir({ XDG_STATE_HOME: "/srv/xdg" })).toBe(
      join("/srv/xdg", "pi", "quota"),
    );
  });

  it("falls back to ~/.local/state/pi/quota", () => {
    const home = "/home/test";
    expect(quotaStateDir({}, home)).toBe(
      join(home, ".local", "state", "pi", "quota"),
    );
  });
});

describe("emptySnapshot", () => {
  it("starts at the current schema version with revision 0", () => {
    const snapshot = emptySnapshot();
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.revision).toBe(0);
    expect(snapshot.sources).toEqual({});
  });
});

describe("writeSnapshot + loadSnapshot", () => {
  let root: string;

  beforeEach(() => {
    root = tempRoot();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("persists and reloads a snapshot atomically", async () => {
    const snapshot = makeSnapshot({
      revision: 1,
      sources: {
        [`${CODEX.identity.providerId}/${CODEX.identity.sourceId}`]:
          makeRecord(),
      },
    });

    const store = createSnapshotStore({ stateDir: root });
    await store.write(snapshot);
    const loaded = await store.load();
    expect(loaded).toEqual(snapshot);
  });

  it("ignores corrupt snapshots and requests a refresh", async () => {
    const file = join(root, "snapshot.json");
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });
    await writeFile(file, "not valid json");

    const loaded = await readSnapshotFile(file);
    expect(loaded).toBeNull();
  });

  it("rejects snapshots with mismatched version", async () => {
    const snapshot = makeSnapshot({ version: SNAPSHOT_VERSION + 1 });
    const file = join(root, "snapshot.json");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(root, { recursive: true });
    await writeFile(file, JSON.stringify(snapshot));

    const loaded = await readSnapshotFile(file);
    expect(loaded).toBeNull();
  });
});
