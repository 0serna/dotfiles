import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuotaAdapter } from "../adapter-registry.js";
import { silentLogger } from "../adapter-test-utils.js";
import { createQuotaRefresh, type QuotaRefresh } from "../quota-refresh.js";
import { createSnapshotStore, emptySnapshot } from "../snapshot-store.js";

const roots: string[] = [];
const instances: QuotaRefresh[] = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "quota-refresh-"));
  roots.push(root);
  return root;
}

function adapter(
  providerId: string,
  fetch: QuotaAdapter["fetch"],
): QuotaAdapter {
  return {
    providerId,
    describe(input) {
      return {
        identity: { providerId, sourceId: input.sourceId },
        displayName: `${providerId}:${input.sourceId}`,
        compactPrefix: providerId,
        configFingerprint: `${providerId}:${input.sourceId}`,
      };
    },
    fetch,
  };
}

function create(root: string, adapters: QuotaAdapter[], freshnessMs = 60_000) {
  const refresh = createQuotaRefresh({
    stateDir: root,
    adapters,
    logger: silentLogger,
    freshnessMs,
    watcherPollIntervalMs: 10,
  });
  instances.push(refresh);
  return refresh;
}

function source(providerId = "provider-a", sourceId = "a") {
  return { providerId, sourceId, credentials: {} };
}

async function waitFor(predicate: () => boolean, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(predicate()).toBe(true);
}

afterEach(async () => {
  await Promise.all(instances.splice(0).map((instance) => instance.shutdown()));
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("quota refresh interface", () => {
  it("publishes a fresh startup snapshot without fetching", async () => {
    const root = temporaryRoot();
    const store = createSnapshotStore({ stateDir: root });
    await store.write({
      ...emptySnapshot(),
      revision: 1,
      cycle: { cycleStartedAt: Date.now(), lastCompletedAt: Date.now() },
    });
    const fetch = vi.fn();
    const refresh = create(root, [adapter("provider-a", fetch)]);
    const revisions: number[] = [];
    refresh.onSnapshot((snapshot) => revisions.push(snapshot.revision));
    await refresh.start({ sources: [source()], registerStatus: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(revisions).toContain(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns from stale startup and publishes sources incrementally", async () => {
    const root = temporaryRoot();
    let releaseSlow: (() => void) | undefined;
    const refresh = create(
      root,
      [
        adapter("slow", async () => {
          await new Promise<void>((resolve) => (releaseSlow = resolve));
          return {
            state: "ok",
            windows: {
              rolling: { remainingPercent: 80, resetAt: 2_000_000_000 },
            },
          };
        }),
        adapter("fast", async () => ({
          state: "ok",
          windows: {
            rolling: { remainingPercent: 40, resetAt: 2_000_000_000 },
          },
        })),
      ],
      100_000,
    );
    let fastPublished = false;
    refresh.onSnapshot((snapshot) => {
      if (snapshot.sources["fast/b"]?.state === "fresh") fastPublished = true;
    });
    await refresh.start({
      sources: [source("slow", "a"), source("fast", "b")],
      registerStatus: vi.fn(),
    });
    await waitFor(() => fastPublished);
    releaseSlow?.();
    await waitFor(() => false, 1).catch(() => undefined);
    expect(fastPublished).toBe(true);
  });

  it("retries a failing source before publishing success", async () => {
    const root = temporaryRoot();
    let attempts = 0;
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      queueMicrotask(() => controller.abort());
      return controller.signal;
    });
    const refresh = create(
      root,
      [
        adapter("provider-a", async () => {
          attempts += 1;
          if (attempts < 3) return { state: "error", reason: "temporary" };
          return {
            state: "ok",
            windows: {
              rolling: { remainingPercent: 75, resetAt: 2_000_000_000 },
            },
          };
        }),
      ],
      100_000,
    );
    await refresh.start({ sources: [source()], registerStatus: vi.fn() });
    await waitFor(() => attempts === 3);
    await waitFor(
      asyncFlag(() =>
        refresh
          .read()
          .then(
            (snapshot) => snapshot.sources["provider-a/a"]?.state === "fresh",
          ),
      ),
    );
    expect(attempts).toBe(3);
  });

  it("coalesces refreshes through the shared lease", async () => {
    const root = temporaryRoot();
    let release: (() => void) | undefined;
    let calls = 0;
    const shared = adapter("provider-a", async () => {
      calls += 1;
      await new Promise<void>((resolve) => (release = resolve));
      return {
        state: "ok",
        windows: { rolling: { remainingPercent: 80, resetAt: 2_000_000_000 } },
      };
    });
    const first = create(root, [shared], 0);
    const second = create(root, [shared], 0);
    await first.start({ sources: [source()], registerStatus: vi.fn() });
    await waitFor(() => calls === 1);
    await second.start({ sources: [source()], registerStatus: vi.fn() });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(1);
    release?.();
  });

  it("aborts active source requests and clears status on shutdown", async () => {
    const root = temporaryRoot();
    let aborted = false;
    let started = false;
    const refresh = create(
      root,
      [
        adapter(
          "provider-a",
          (_input, signal) =>
            new Promise((resolve) => {
              started = true;
              signal.addEventListener(
                "abort",
                () => {
                  aborted = true;
                  resolve({ state: "error", reason: "aborted" });
                },
                { once: true },
              );
            }),
        ),
      ],
      100_000,
    );
    const status = vi.fn();
    await refresh.start({ sources: [source()], registerStatus: status });
    await waitFor(() => started);
    await refresh.shutdown();
    expect(aborted).toBe(true);
    expect(status).toHaveBeenLastCalledWith(undefined);
  });

  it("keeps snapshot and lease paths isolated between state directories", async () => {
    const firstRoot = temporaryRoot();
    const secondRoot = temporaryRoot();
    let firstRelease: (() => void) | undefined;
    let secondCalls = 0;
    const first = create(
      firstRoot,
      [
        adapter("provider-a", async () => {
          await new Promise<void>((resolve) => (firstRelease = resolve));
          return {
            state: "ok",
            windows: {
              rolling: { remainingPercent: 10, resetAt: 2_000_000_000 },
            },
          };
        }),
      ],
      100_000,
    );
    const second = create(
      secondRoot,
      [
        adapter("provider-a", async () => {
          secondCalls += 1;
          return {
            state: "ok",
            windows: {
              rolling: { remainingPercent: 90, resetAt: 2_000_000_000 },
            },
          };
        }),
      ],
      100_000,
    );
    await first.start({ sources: [source()], registerStatus: vi.fn() });
    await second.start({ sources: [source()], registerStatus: vi.fn() });
    await waitFor(() => firstRelease !== undefined && secondCalls === 1);
    firstRelease?.();
    await waitFor(
      asyncFlag(() =>
        second
          .read()
          .then(
            (s) =>
              s.sources["provider-a/a"]?.windows?.rolling?.remainingPercent ===
              90,
          ),
      ),
    );
    expect(
      (await createSnapshotStore({ stateDir: firstRoot }).load())?.revision,
    ).toBeGreaterThan(0);
    expect(
      (await createSnapshotStore({ stateDir: secondRoot }).load())?.sources[
        "provider-a/a"
      ]?.windows?.rolling?.remainingPercent,
    ).toBe(90);
  });
});

function asyncFlag(check: () => Promise<boolean>): () => boolean {
  let value = false;
  const poll = () =>
    void check().then((result) => {
      value = result;
      if (!value) setTimeout(poll, 2);
    });
  poll();
  return () => value;
}
