import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { silentLogger } from "../adapter-test-utils.js";
import {
  createCoordinator,
  registerAdapter,
  resetAdapterRegistry,
  type Coordinator,
  type QuotaAdapter,
  type QuotaCoordinatorOptions,
} from "../coordinator.js";
import { setLeaseDirectory } from "../refresh-lease.js";
import { resetSnapshotStore } from "../snapshot-store.js";
import type { QuotaSnapshot, SourceDescriptor } from "../snapshot.js";

const PROVIDER_A = "provider-a";
const PROVIDER_B = "provider-b";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "quota-coord-"));
}

function makeAdapter(
  providerId: string,
  fetchImpl: QuotaAdapter["fetch"],
): QuotaAdapter {
  return {
    providerId,
    describe(input): SourceDescriptor {
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

function sourceFetch(
  _sourceId: string,
  remainingPercent: number,
  delay = 5,
): QuotaAdapter["fetch"] {
  return async (_input, signal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      });
    });
    if (signal.aborted) return { state: "error", reason: "aborted" };
    return {
      state: "ok",
      windows: {
        rolling: { remainingPercent, resetAt: 1_700_000_000 },
      },
    };
  };
}

let root: string;
let coordinator: Coordinator;
let options: QuotaCoordinatorOptions;

beforeEach(() => {
  resetAdapterRegistry();
  root = tempRoot();
  resetSnapshotStore({ stateDir: root, lockDir: join(root, "locks") });
  setLeaseDirectory(join(root, "lease"));
  options = {
    snapshotDir: root,
    stateDir: root,
    lockDir: join(root, "locks"),
    leaseDir: join(root, "lease"),
    logger: silentLogger,
    maxAttempts: 2,
  };
  coordinator = createCoordinator(options);
});

afterEach(async () => {
  await coordinator.shutdown();
  resetAdapterRegistry();
  rmSync(root, { recursive: true, force: true });
});

describe("coordinator.refresh", () => {
  it("starts fetchable sources concurrently and publishes each as it resolves", async () => {
    registerAdapter(makeAdapter(PROVIDER_A, sourceFetch("a", 80, 30)));
    registerAdapter(makeAdapter(PROVIDER_B, sourceFetch("b", 40, 5)));

    const updates: number[] = [];
    coordinator.subscribe((snapshot: QuotaSnapshot) => {
      updates.push(snapshot.revision);
    });

    await coordinator.refresh([
      {
        providerId: PROVIDER_A,
        sourceId: "a",
        credentials: { token: "a" } as never,
      },
      {
        providerId: PROVIDER_B,
        sourceId: "b",
        credentials: { token: "b" } as never,
      },
    ]);

    const snapshot = await coordinator.read();
    const keys = Object.keys(snapshot.sources);
    expect(keys).toContain(`${PROVIDER_A}/a`);
    expect(keys).toContain(`${PROVIDER_B}/b`);
    expect(updates.length).toBeGreaterThanOrEqual(2);
  });

  it("publishes a fast source while a sibling source is still pending", async () => {
    let releaseSlow: (() => void) | undefined;
    registerAdapter(
      makeAdapter(PROVIDER_A, async () => {
        await new Promise<void>((resolve) => {
          releaseSlow = resolve;
        });
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 80, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    registerAdapter(
      makeAdapter(PROVIDER_B, async () => ({
        state: "ok",
        windows: {
          rolling: { remainingPercent: 40, resetAt: 1_700_000_000 },
        },
      })),
    );
    const fastPublished = new Promise<QuotaSnapshot>((resolve) => {
      coordinator.subscribe((snapshot) => {
        if (snapshot.sources[`${PROVIDER_B}/b`]?.state === "fresh") {
          resolve(snapshot);
        }
      });
    });

    const refresh = coordinator.refresh([
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
      { providerId: PROVIDER_B, sourceId: "b", credentials: {} as never },
    ]);
    const partial = await fastPublished;
    releaseSlow?.();
    await refresh;

    expect(partial.sources[`${PROVIDER_B}/b`]?.state).toBe("fresh");
    expect(partial.sources[`${PROVIDER_A}/a`]?.state).toBe("refreshing");
  });

  it("retries failed sources up to two total attempts", async () => {
    let attempts = 0;
    const fetch: QuotaAdapter["fetch"] = async (_input, signal) => {
      attempts += 1;
      if (attempts === 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 5);
        });
        return { state: "error", reason: "fetch_failed" };
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5);
      });
      if (signal.aborted) return { state: "error", reason: "aborted" };
      return {
        state: "ok",
        windows: { rolling: { remainingPercent: 90, resetAt: 1_700_000_000 } },
      };
    };
    registerAdapter(makeAdapter(PROVIDER_A, fetch));

    await coordinator.refresh([
      {
        providerId: PROVIDER_A,
        sourceId: "a",
        credentials: { token: "a" } as never,
      },
    ]);

    const snapshot = await coordinator.read();
    const key = `${PROVIDER_A}/a`;
    expect(snapshot.sources[key]?.state).toBe("fresh");
    expect(attempts).toBe(2);
  });

  it("preserves a successful source when a sibling source exhausts both attempts", async () => {
    registerAdapter(makeAdapter(PROVIDER_A, sourceFetch("a", 70)));
    registerAdapter(
      makeAdapter(PROVIDER_B, async () => ({
        state: "error",
        reason: "fetch_failed",
      })),
    );

    await coordinator.refresh([
      {
        providerId: PROVIDER_A,
        sourceId: "a",
        credentials: { token: "a" } as never,
      },
      {
        providerId: PROVIDER_B,
        sourceId: "b",
        credentials: { token: "b" } as never,
      },
    ]);

    const snapshot = await coordinator.read();
    expect(snapshot.sources[`${PROVIDER_A}/a`]?.state).toBe("fresh");
    expect(snapshot.sources[`${PROVIDER_B}/b`]?.state).toBe("unavailable");
  });
});

describe("coordinator.recordExhaustion", () => {
  it("writes provider-confirmed exhaustion without affecting sibling sources", async () => {
    registerAdapter(makeAdapter(PROVIDER_A, sourceFetch("a", 70)));
    registerAdapter(makeAdapter(PROVIDER_B, sourceFetch("b", 50)));

    await coordinator.refresh([
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
      { providerId: PROVIDER_B, sourceId: "b", credentials: {} as never },
    ]);

    await coordinator.recordExhaustion(
      { providerId: PROVIDER_A, sourceId: "a" },
      { confirmedAt: Date.now(), reportedBy: "session-1" },
    );

    const snapshot = await coordinator.read();
    expect(snapshot.sources[`${PROVIDER_A}/a`]?.state).toBe("exhausted");
    expect(snapshot.sources[`${PROVIDER_B}/b`]?.state).toBe("fresh");
  });

  it("preserves unrelated exhaustion updates from concurrent coordinators", async () => {
    registerAdapter(makeAdapter(PROVIDER_A, sourceFetch("a", 70)));
    registerAdapter(makeAdapter(PROVIDER_B, sourceFetch("b", 50)));
    const sources = [
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
      { providerId: PROVIDER_B, sourceId: "b", credentials: {} as never },
    ];
    await coordinator.refresh(sources);

    const first = createCoordinator(options);
    const second = createCoordinator(options);
    await first.ensureFresh(sources);
    await second.ensureFresh(sources);

    await Promise.all([
      first.recordExhaustion(
        { providerId: PROVIDER_A, sourceId: "a" },
        { confirmedAt: Date.now(), reportedBy: "session-1" },
      ),
      second.recordExhaustion(
        { providerId: PROVIDER_B, sourceId: "b" },
        { confirmedAt: Date.now(), reportedBy: "session-2" },
      ),
    ]);

    const observer = createCoordinator(options);
    await observer.ensureFresh(sources);
    const snapshot = await observer.read();
    expect(snapshot.sources[`${PROVIDER_A}/a`]?.state).toBe("exhausted");
    expect(snapshot.sources[`${PROVIDER_B}/b`]?.state).toBe("exhausted");

    await first.shutdown();
    await second.shutdown();
    await observer.shutdown();
  });
});

describe("coordinator configuration reconciliation", () => {
  it("preserves a valid shared observation when local credentials are missing", async () => {
    registerAdapter(
      makeAdapter(PROVIDER_A, async (input) => {
        if (!input.credentials) {
          return { state: "skipped", reason: "config_missing" };
        }
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent: 70, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    const configured = [
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
    ];
    await coordinator.refresh(configured);

    const incomplete = createCoordinator({ ...options, freshnessMs: 0 });
    await incomplete.refresh([
      { providerId: PROVIDER_A, sourceId: "a", credentials: undefined },
    ]);
    const snapshot = await incomplete.read();

    expect(snapshot.sources[`${PROVIDER_A}/a`]?.state).toBe("fresh");
    expect(
      snapshot.sources[`${PROVIDER_A}/a`]?.windows?.rolling?.remainingPercent,
    ).toBe(70);
    expect(snapshot.sources[`${PROVIDER_A}/a`]?.configConflict).toContain(
      "config_missing",
    );
    await incomplete.shutdown();
  });

  it("does not fetch over a valid observation when fingerprints conflict", async () => {
    let remainingPercent = 70;
    let calls = 0;
    registerAdapter(
      makeAdapter(PROVIDER_A, async () => {
        calls += 1;
        return {
          state: "ok",
          windows: {
            rolling: { remainingPercent, resetAt: 1_700_000_000 },
          },
        };
      }),
    );
    await coordinator.refresh([
      {
        providerId: PROVIDER_A,
        sourceId: "a",
        configFingerprint: "configuration-a",
        credentials: {} as never,
      },
    ]);
    remainingPercent = 20;

    const conflicting = createCoordinator({ ...options, freshnessMs: 0 });
    await conflicting.refresh([
      {
        providerId: PROVIDER_A,
        sourceId: "a",
        configFingerprint: "configuration-b",
        credentials: {} as never,
      },
    ]);
    const snapshot = await conflicting.read();

    expect(calls).toBe(1);
    expect(
      snapshot.sources[`${PROVIDER_A}/a`]?.windows?.rolling?.remainingPercent,
    ).toBe(70);
    expect(snapshot.sources[`${PROVIDER_A}/a`]?.configConflict).toContain(
      "configuration-a",
    );
    await conflicting.shutdown();
  });
});

describe("coordinator observers", () => {
  it("stops delivering updates after the subscription is disposed", async () => {
    registerAdapter(makeAdapter(PROVIDER_A, sourceFetch("a", 80)));
    const seen: number[] = [];
    const sub = coordinator.subscribe((snapshot) => {
      seen.push(snapshot.revision);
    });
    await coordinator.refresh([
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
    ]);
    sub.close();
    const lastSeen = seen.length;
    await coordinator.refresh([
      { providerId: PROVIDER_A, sourceId: "a", credentials: {} as never },
    ]);
    expect(seen.length).toBe(lastSeen);
  });
});
