import { describe, expect, it, vi } from "vitest";
import {
  type AdapterLogger,
  type QuotaAdapter,
  registerAdapter,
  resetAdapterRegistry,
} from "../adapter-registry.js";
import { silentLogger } from "../adapter-test-utils.js";
import { createCoordinator } from "../coordinator.js";
import { setLeaseDirectory } from "../refresh-lease.js";
import { resetSnapshotStore } from "../snapshot-store.js";

function makeAdapter(
  providerId: string,
  fetchImpl: QuotaAdapter["fetch"],
): QuotaAdapter {
  return {
    providerId,
    describe(input) {
      return {
        identity: { providerId, sourceId: input.sourceId },
        displayName: `${providerId}:${input.sourceId}`,
        compactPrefix: providerId,
        configFingerprint: `fingerprint:${providerId}:${input.sourceId}`,
      };
    },
    fetch: fetchImpl,
  };
}

function makeCollectingLogger(): {
  logger: AdapterLogger;
  events: Array<{ event: string; data?: Record<string, unknown> }>;
} {
  const events: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const logger: AdapterLogger = {
    log(event, data) {
      events.push({ event, data });
    },
  };
  return { logger, events };
}

describe("structured quota logs", () => {
  it("emits refresh cycle and source attempt events", async () => {
    resetAdapterRegistry();
    const { logger, events } = makeCollectingLogger();
    registerAdapter(
      makeAdapter("provider-a", async () => ({
        state: "ok",
        windows: { rolling: { remainingPercent: 80, resetAt: 1_700_000_000 } },
      })),
    );
    const stateDir = "/tmp/quota-logs-" + Date.now();
    resetSnapshotStore({ stateDir, lockDir: `${stateDir}/locks` });
    setLeaseDirectory(`${stateDir}/lease`);
    const coordinator = createCoordinator({
      stateDir,
      lockDir: `${stateDir}/locks`,
      leaseDir: `${stateDir}/lease`,
      logger,
    });
    await coordinator.refresh([
      { providerId: "provider-a", sourceId: "a", credentials: {} as never },
    ]);
    const eventNames = events.map((e) => e.event);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        "refresh_lease_acquired",
        "refresh_cycle_started",
        "source_attempt",
        "source_result",
        "snapshot_published",
        "refresh_cycle_completed",
        "refresh_lease_released",
      ]),
    );
    await coordinator.shutdown();
  });

  it("logs degradation and expiry transitions", async () => {
    resetAdapterRegistry();
    const { logger, events } = makeCollectingLogger();
    let failing = false;
    registerAdapter(
      makeAdapter("provider-a", async () =>
        failing
          ? { state: "error", reason: "fetch_failed" }
          : {
              state: "ok",
              windows: {
                rolling: {
                  remainingPercent: 80,
                  resetAt: 1_900_000_000,
                },
              },
            },
      ),
    );
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const stateDir = `/tmp/quota-logs-state-${process.pid}-${Math.random()}`;
    vi.spyOn(Math, "random").mockReturnValue(0);
    resetSnapshotStore({ stateDir, lockDir: `${stateDir}/locks` });
    setLeaseDirectory(`${stateDir}/lease`);
    const coordinator = createCoordinator({
      stateDir,
      lockDir: `${stateDir}/locks`,
      leaseDir: `${stateDir}/lease`,
      logger,
    });
    const sources = [
      { providerId: "provider-a", sourceId: "a", credentials: {} as never },
    ];

    await coordinator.refresh(sources);
    failing = true;
    await coordinator.refresh(sources);
    vi.mocked(Date.now).mockReturnValue(now + 31 * 60 * 1000);
    await coordinator.refresh(sources);

    const eventNames = events.map((event) => event.event);
    expect(eventNames).toContain("source_degraded");
    expect(eventNames).toContain("source_expired");
    vi.restoreAllMocks();
    await coordinator.shutdown();
  });

  it("never logs secrets or raw response bodies", async () => {
    resetAdapterRegistry();
    const { logger, events } = makeCollectingLogger();
    registerAdapter(
      makeAdapter("provider-a", async () => ({
        state: "ok",
        windows: { rolling: { remainingPercent: 80, resetAt: 1_700_000_000 } },
      })),
    );
    const stateDir = "/tmp/quota-logs-secrets-" + Date.now();
    resetSnapshotStore({ stateDir, lockDir: `${stateDir}/locks` });
    setLeaseDirectory(`${stateDir}/lease`);
    const coordinator = createCoordinator({
      stateDir,
      lockDir: `${stateDir}/locks`,
      leaseDir: `${stateDir}/lease`,
      logger,
    });
    const secret = "super-secret-token";
    await coordinator.refresh([
      {
        providerId: "provider-a",
        sourceId: "a",
        credentials: { token: secret } as never,
      },
    ]);
    for (const event of events) {
      const serialized = JSON.stringify(event.data ?? {});
      expect(serialized).not.toContain(secret);
    }
    await coordinator.shutdown();
  });

  it("emits an unavailable log when a source has no credentials", async () => {
    resetAdapterRegistry();
    const { logger, events } = makeCollectingLogger();
    // Register a codex-like adapter that returns error on missing credentials.
    const codexAdapter: QuotaAdapter = {
      providerId: "provider-with-creds",
      describe: (input) => ({
        identity: {
          providerId: "provider-with-creds",
          sourceId: input.sourceId,
        },
        displayName: input.sourceId,
        compactPrefix: "Test",
        configFingerprint: "f",
      }),
      async fetch(input, _signal, log) {
        if (!(input.credentials as { token?: string } | undefined)?.token) {
          log.log("fetch_failed", { reason: "auth_missing" });
          return { state: "error", reason: "auth_missing" };
        }
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 50, resetAt: 1_700_000_000 },
          },
        };
      },
    };
    registerAdapter(codexAdapter);
    const stateDir = "/tmp/quota-logs-unavail-" + Date.now();
    resetSnapshotStore({ stateDir, lockDir: `${stateDir}/locks` });
    setLeaseDirectory(`${stateDir}/lease`);
    const coordinator = createCoordinator({
      stateDir,
      lockDir: `${stateDir}/locks`,
      leaseDir: `${stateDir}/lease`,
      logger,
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    await coordinator.refresh([
      {
        providerId: "provider-with-creds",
        sourceId: "a",
        credentials: undefined,
      },
    ]);
    const eventNames = events.map((e) => e.event);
    expect(eventNames).toContain("fetch_failed");
    vi.restoreAllMocks();
    await coordinator.shutdown();
  });

  it("uses a silent logger in tests when not provided", () => {
    expect(silentLogger).toBeDefined();
    expect(typeof silentLogger.log).toBe("function");
  });
});
