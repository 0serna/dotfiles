import { describe, expect, it } from "vitest";
import {
  type ConfigurationFingerprint,
  buildConfigurationFingerprint,
  reconcileSnapshot,
} from "../config-fingerprint.js";
import { emptySnapshot } from "../snapshot-store.js";
import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceRecord,
  SNAPSHOT_VERSION,
} from "../snapshot.js";

function makeDescriptor(
  overrides: Partial<SourceDescriptor> = {},
): SourceDescriptor {
  return {
    identity: { providerId: "opencode-go", sourceId: "opencode-go:1" },
    displayName: "OpenCode 1",
    compactPrefix: "OpenCode",
    configFingerprint: "fingerprint:opencode-go:1",
    ...overrides,
  };
}

function snapshot(overrides: Partial<QuotaSnapshot> = {}): QuotaSnapshot {
  return { ...emptySnapshot(), ...overrides };
}

describe("buildConfigurationFingerprint", () => {
  it("hashes the same inputs to the same fingerprint", () => {
    const a: ConfigurationFingerprint = buildConfigurationFingerprint({
      providerId: "opencode-go",
      sourceId: "1",
      accountName: "1",
      workspaceEnv: "OC_GO_WORKSPACE_1",
      cookieEnv: "OC_GO_COOKIE_1",
    });
    const b: ConfigurationFingerprint = buildConfigurationFingerprint({
      providerId: "opencode-go",
      sourceId: "1",
      accountName: "1",
      workspaceEnv: "OC_GO_WORKSPACE_1",
      cookieEnv: "OC_GO_COOKIE_1",
    });
    expect(a).toBe(b);
  });

  it("returns a different fingerprint for different env-var names", () => {
    const a = buildConfigurationFingerprint({
      providerId: "opencode-go",
      sourceId: "1",
      accountName: "1",
      workspaceEnv: "OC_GO_WORKSPACE_1",
      cookieEnv: "OC_GO_COOKIE_1",
    });
    const b = buildConfigurationFingerprint({
      providerId: "opencode-go",
      sourceId: "1",
      accountName: "1",
      workspaceEnv: "OC_GO_WORKSPACE_2",
      cookieEnv: "OC_GO_COOKIE_1",
    });
    expect(a).not.toBe(b);
  });
});

describe("reconcileSnapshot", () => {
  const local: SourceDescriptor = makeDescriptor({
    configFingerprint: buildConfigurationFingerprint({
      providerId: "opencode-go",
      sourceId: "1",
      accountName: "1",
      workspaceEnv: "OC_GO_WORKSPACE_1",
      cookieEnv: "OC_GO_COOKIE_1",
    }),
  });

  it("keeps the shared observation when local config matches the snapshot", () => {
    const sharedRecord: SourceRecord = {
      identity: local.identity,
      descriptor: local,
      state: "current",
      observedAt: 1_000,
      lastSuccessAt: 1_000,
      windows: {
        rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
      },
    };
    const base = snapshot({
      sources: {
        [`${local.identity.providerId}/${local.identity.sourceId}`]:
          sharedRecord,
      },
    });
    const result = reconcileSnapshot(base, [local]);
    const key = `${local.identity.providerId}/${local.identity.sourceId}`;
    expect(result.sources[key]?.windows).toEqual(sharedRecord.windows);
    expect(result.sources[key]?.configConflict).toBeUndefined();
  });

  it("records a configuration conflict and refuses to overwrite a valid observation", () => {
    const sharedRecord: SourceRecord = {
      identity: local.identity,
      descriptor: makeDescriptor({
        configFingerprint: "fingerprint:opencode-go:1:remote",
      }),
      state: "current",
      observedAt: 1_000,
      lastSuccessAt: 1_000,
      windows: {
        rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
      },
    };
    const base = snapshot({
      sources: {
        [`${local.identity.providerId}/${local.identity.sourceId}`]:
          sharedRecord,
      },
    });
    const result = reconcileSnapshot(base, [local]);
    const key = `${local.identity.providerId}/${local.identity.sourceId}`;
    expect(result.sources[key]?.windows).toEqual(sharedRecord.windows);
    expect(result.sources[key]?.configConflict).toContain("disagrees");
  });

  it("removes source declarations that are no longer present locally", () => {
    const orphanRecord: SourceRecord = {
      identity: { providerId: "opencode-go", sourceId: "opencode-go:2" },
      descriptor: makeDescriptor({
        identity: { providerId: "opencode-go", sourceId: "opencode-go:2" },
        displayName: "OpenCode 2",
        configFingerprint: "fingerprint:opencode-go:2",
      }),
      state: "current",
      observedAt: 1_000,
      lastSuccessAt: 1_000,
    };
    const base = snapshot({
      sources: {
        "opencode-go/opencode-go:2": orphanRecord,
      },
    });
    const result = reconcileSnapshot(base, [local]);
    expect(result.sources).not.toHaveProperty("opencode-go/opencode-go:2");
  });
});

describe("SNAPSHOT_VERSION guard", () => {
  it("ignores snapshots with mismatched version", () => {
    const base = snapshot({ version: SNAPSHOT_VERSION + 1 });
    const result = reconcileSnapshot(base, [makeDescriptor()]);
    expect(result.version).toBe(SNAPSHOT_VERSION);
  });
});
