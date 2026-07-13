import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { silentLogger } from "../adapter-test-utils.js";
import {
  createCoordinator,
  registerAdapter,
  resetAdapterRegistry,
  type QuotaAdapter,
} from "../coordinator.js";
import { setLeaseDirectory } from "../refresh-lease.js";
import { resetSnapshotStore } from "../snapshot-store.js";

const PROVIDER = "provider-a";

function makeAdapter(fetchImpl: QuotaAdapter["fetch"]): QuotaAdapter {
  return {
    providerId: PROVIDER,
    describe(input) {
      return {
        identity: { providerId: PROVIDER, sourceId: input.sourceId },
        displayName: `${PROVIDER}:${input.sourceId}`,
        compactPrefix: PROVIDER,
        configFingerprint: `fingerprint:${PROVIDER}:${input.sourceId}`,
      };
    },
    fetch: fetchImpl,
  };
}

let root: string;

beforeEach(() => {
  resetAdapterRegistry();
  root = mkdtempSync(join(tmpdir(), "quota-ensure-"));
  resetSnapshotStore({ stateDir: root, lockDir: join(root, "locks") });
  setLeaseDirectory(join(root, "lease"));
});

afterEach(() => {
  resetAdapterRegistry();
  rmSync(root, { recursive: true, force: true });
});

describe("coordinator.ensureFresh", () => {
  it("returns refreshed:false when a recent refresh is in memory", async () => {
    let calls = 0;
    registerAdapter(
      makeAdapter(async () => {
        calls += 1;
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    const coordinator = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 60_000,
    });
    await coordinator.refresh([
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ]);
    const result = await coordinator.ensureFresh([
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ]);
    expect(result.refreshed).toBe(false);
    expect(calls).toBe(1);
    await coordinator.shutdown();
  });

  it("returns refreshed:true when no recent refresh has happened", async () => {
    let calls = 0;
    registerAdapter(
      makeAdapter(async () => {
        calls += 1;
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    const coordinator = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 0,
    });
    const result = await coordinator.ensureFresh([
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ]);
    expect(result.refreshed).toBe(true);
    expect(calls).toBe(1);
    await coordinator.shutdown();
  });
});

describe("cross-process coalescing", () => {
  it("lets the first process acquire the lease and the second does not fetch", async () => {
    let firstCalls = 0;
    const sharedFetch = async () => {
      firstCalls += 1;
      return {
        state: "ok" as const,
        windows: { rolling: { remainingPercent: 80, resetAt: 1_700_000_000 } },
      };
    };
    const sharedAdapter = makeAdapter(sharedFetch);
    registerAdapter(sharedAdapter);

    const first = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 0,
    });
    await first.refresh([
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ]);

    const second = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 5 * 60 * 1000,
    });
    const result = await second.ensureFresh([
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ]);
    expect(result.refreshed).toBe(false);
    expect(firstCalls).toBe(1);
    await first.shutdown();
    await second.shutdown();
  });

  it("does not duplicate an in-flight refresh owned by another coordinator", async () => {
    let calls = 0;
    let releaseFetch: (() => void) | undefined;
    let fetchStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    registerAdapter(
      makeAdapter(async () => {
        calls += 1;
        fetchStarted?.();
        await new Promise<void>((resolve) => {
          releaseFetch = resolve;
        });
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
          },
        };
      }),
    );

    const first = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 0,
    });
    const second = createCoordinator({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 0,
    });
    const sources = [
      { providerId: PROVIDER, sourceId: "a", credentials: {} as never },
    ];

    const ownerRefresh = first.ensureFresh(sources);
    await started;
    const contenderResult = await second.ensureFresh(sources);

    expect(contenderResult.refreshed).toBe(false);
    expect(calls).toBe(1);

    releaseFetch?.();
    await ownerRefresh;
    await first.shutdown();
    await second.shutdown();
  });
});
