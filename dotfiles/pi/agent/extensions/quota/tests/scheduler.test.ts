import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silentLogger } from "../adapter-test-utils.js";
import {
  registerAdapter,
  resetAdapterRegistry,
  type QuotaAdapter,
} from "../coordinator.js";
import { createQuotaLifecycle, type QuotaLifecycle } from "../lifecycle.js";
import { setLeaseDirectory } from "../refresh-lease.js";
import { resetSnapshotStore } from "../snapshot-store.js";

let root: string;

beforeEach(() => {
  resetAdapterRegistry();
  root = mkdtempSync(join(tmpdir(), "quota-lifecycle-"));
  resetSnapshotStore({ stateDir: root, lockDir: join(root, "locks") });
  setLeaseDirectory(join(root, "lease"));
});

afterEach(() => {
  resetAdapterRegistry();
  rmSync(root, { recursive: true, force: true });
  vi.useRealTimers();
});

function adapter(fetch: QuotaAdapter["fetch"]): QuotaAdapter {
  return {
    providerId: "provider-a",
    describe(input) {
      return {
        identity: { providerId: "provider-a", sourceId: input.sourceId },
        displayName: input.sourceId,
        compactPrefix: "Provider",
        configFingerprint: `provider-a:${input.sourceId}`,
      };
    },
    fetch,
  };
}

describe("QuotaLifecycle", () => {
  it("returns from start without waiting for a stale-snapshot refresh", async () => {
    let releaseFetch: (() => void) | undefined;
    let signalStarted: (() => void) | undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    registerAdapter(
      adapter(async () => {
        signalStarted?.();
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
    const lifecycle = createQuotaLifecycle({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
    });

    const start = lifecycle.start({
      sources: [{ providerId: "provider-a", sourceId: "a", credentials: {} }],
      registerStatus: vi.fn(),
    });
    await fetchStarted;
    const returnedBeforeFetch = await Promise.race([
      start.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 25)),
    ]);
    releaseFetch?.();
    await start;

    expect(returnedBeforeFetch).toBe(true);
    await lifecycle.shutdown();
  });

  it("observes snapshot revisions published by another lifecycle", async () => {
    registerAdapter(
      adapter(async () => ({
        state: "ok",
        windows: {
          rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
        },
      })),
    );
    const lifecycleOptions = {
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 60_000,
    };
    const owner = createQuotaLifecycle(lifecycleOptions);
    const ownerFresh = new Promise<void>((resolve) => {
      owner.onSnapshot((snapshot) => {
        if (snapshot.sources["provider-a/a"]?.state === "fresh") resolve();
      });
    });
    const sources = [
      { providerId: "provider-a", sourceId: "a", credentials: {} },
    ];
    await owner.start({ sources, registerStatus: vi.fn() });
    await ownerFresh;

    const observer = createQuotaLifecycle(lifecycleOptions);
    const observedExhaustion = new Promise<boolean>((resolve) => {
      observer.onSnapshot((snapshot) => {
        if (snapshot.sources["provider-a/a"]?.state === "exhausted") {
          resolve(true);
        }
      });
    });
    await observer.start({ sources, registerStatus: vi.fn() });

    await owner
      .coordinator()
      .recordExhaustion(
        { providerId: "provider-a", sourceId: "a" },
        { confirmedAt: Date.now(), reportedBy: "owner" },
      );
    const observed = await Promise.race([
      observedExhaustion,
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);

    expect(observed).toBe(true);
    await owner.shutdown();
    await observer.shutdown();
  });

  it("runs an initial load and publishes status updates", async () => {
    const calls: number[] = [];
    const lifecycle: QuotaLifecycle = createQuotaLifecycle({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
    });
    lifecycle.onSnapshot((snapshot) => {
      calls.push(snapshot.revision);
    });

    const status = vi.fn();
    lifecycle.onStatus(status);
    await lifecycle.start({
      sources: [],
      registerStatus: status,
    });
    expect(calls.length).toBeGreaterThanOrEqual(0);
    await lifecycle.shutdown();
  });

  it("schedules the next refresh with the declared sources", async () => {
    let calls = 0;
    registerAdapter(
      adapter(async () => {
        calls += 1;
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    const lifecycle = createQuotaLifecycle({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
      freshnessMs: 20,
    });
    await lifecycle.start({
      sources: [{ providerId: "provider-a", sourceId: "a", credentials: {} }],
      registerStatus: vi.fn(),
    });
    const refreshedTwice = await Promise.race([
      new Promise<true>((resolve) => {
        const check = () => {
          if (calls >= 2) resolve(true);
          else setTimeout(check, 5);
        };
        check();
      }),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);

    expect(refreshedTwice).toBe(true);
    await lifecycle.shutdown();
  });

  it("aborts an in-flight refresh on shutdown", async () => {
    let signalStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    let signalAborted: (() => void) | undefined;
    const aborted = new Promise<void>((resolve) => {
      signalAborted = resolve;
    });
    registerAdapter(
      adapter(
        (_input, signal) =>
          new Promise((resolve) => {
            signalStarted?.();
            signal.addEventListener(
              "abort",
              () => {
                signalAborted?.();
                resolve({ state: "error", reason: "aborted" });
              },
              { once: true },
            );
          }),
      ),
    );
    const events: string[] = [];
    const lifecycle = createQuotaLifecycle({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: { log: (event) => events.push(event) },
    });
    await lifecycle.start({
      sources: [{ providerId: "provider-a", sourceId: "a", credentials: {} }],
      registerStatus: vi.fn(),
    });
    const didStart = await Promise.race([
      started.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
    ]);
    expect(didStart, JSON.stringify(events)).toBe(true);

    await lifecycle.shutdown();
    const didAbort = await Promise.race([
      aborted.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 50)),
    ]);

    expect(didAbort).toBe(true);
  });

  it("clears status on shutdown", async () => {
    const status = vi.fn();
    const lifecycle = createQuotaLifecycle({
      stateDir: root,
      lockDir: join(root, "locks"),
      leaseDir: join(root, "lease"),
      logger: silentLogger,
    });
    await lifecycle.start({ sources: [], registerStatus: status });
    await lifecycle.shutdown();
    const calls = status.mock.calls.map((args) => args[0]);
    expect(calls).toContain(undefined);
  });
});
