import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type {
  AdapterFetchInput,
  AdapterLogger,
  AdapterResult,
  QuotaAdapter,
} from "./adapter-registry.js";
import { reconcileSnapshot } from "./config-fingerprint.js";
import { createRefreshLeaseStore } from "./refresh-lease.js";
import {
  createSnapshotStore,
  emptySnapshot,
  quotaStateDir,
} from "./snapshot-store.js";
import {
  applySourceFailure,
  applySourceSuccess,
  expireOldObservations,
  recordConfigConflict,
} from "./snapshot-transitions.js";
import { watchSnapshot, type WatcherSubscription } from "./snapshot-watcher.js";
import type {
  QuotaSnapshot,
  SourceDescriptor,
  SourceIdentity,
} from "./snapshot.js";
import { formatCompactStatus, type ColorIntent } from "./status-formatter.js";

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;
const LEASE_TTL_MS = 60_000;
const SOURCE_MAX_ATTEMPTS = 3;
const SOURCE_RETRY_BASE_DELAY_MS = 2_000;
const STATUS_FALLBACK = " ";

export type SourceInput = AdapterFetchInput;
export type QuotaRefreshOptions = {
  stateDir?: string;
  lockDir?: string;
  leaseDir?: string;
  logger: AdapterLogger;
  adapters: ReadonlyArray<QuotaAdapter>;
  freshnessMs?: number;
  watcherPollIntervalMs?: number;
};
export type QuotaRefresh = {
  start(options: {
    sources: SourceInput[];
    registerStatus: (value: string | undefined) => void;
    activeSource?: SourceIdentity;
    colorize?: (intent: ColorIntent, text: string) => string;
  }): Promise<void>;
  setActiveSource(identity: SourceIdentity | undefined): void;
  onStatus(callback: (value: string | undefined) => void): {
    close: () => void;
  };
  onSnapshot(callback: (snapshot: QuotaSnapshot) => void): {
    close: () => void;
  };
  read(): Promise<QuotaSnapshot>;
  shutdown(): Promise<void>;
};

async function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return;
  const combined = AbortSignal.any([signal, AbortSignal.timeout(ms)]);
  if (combined.aborted) return;
  await new Promise<void>((resolve) =>
    combined.addEventListener("abort", () => resolve(), { once: true }),
  );
}

export function createQuotaRefresh(options: QuotaRefreshOptions): QuotaRefresh {
  const stateDir = options.stateDir ?? quotaStateDir();
  const snapshotStore = createSnapshotStore({
    stateDir,
    lockDir: options.lockDir,
  });
  const leaseStore = createRefreshLeaseStore(
    options.leaseDir ?? join(stateDir, "lease"),
  );
  const adapters = new Map(
    options.adapters.map((adapter) => [adapter.providerId, adapter]),
  );
  const freshnessMs = options.freshnessMs ?? DEFAULT_FRESHNESS_MS;
  const ownerId = randomBytes(8).toString("hex");
  const listeners = new Set<(snapshot: QuotaSnapshot) => void>();
  const statusCallbacks = new Set<(value: string | undefined) => void>();
  const activeControllers = new Set<AbortController>();

  let latestSnapshot: QuotaSnapshot = emptySnapshot();
  let lastRefreshCompletedAt = 0;
  let lastSeenRevision = -1;
  let refreshTask: Promise<void> | undefined;
  let pollHandle: ReturnType<typeof setTimeout> | undefined;
  let watcher: WatcherSubscription | undefined;
  let declaredSources: SourceInput[] = [];
  let activeSource: SourceIdentity | undefined;
  let colorize: ((intent: ColorIntent, text: string) => string) | undefined;
  let started = false;
  let stopped = false;

  const publishStatus = (value: string | undefined) => {
    for (const callback of statusCallbacks) {
      try {
        callback(value);
      } catch {
        // A subscriber must not break refresh publication.
      }
    }
  };

  const formatStatus = (snapshot: QuotaSnapshot) =>
    formatCompactStatus(snapshot, { activeSource, colorize }) ||
    STATUS_FALLBACK;

  const scheduleNext = (snapshot: QuotaSnapshot) => {
    if (stopped) return;
    if (pollHandle) clearTimeout(pollHandle);
    const completedAt = snapshot.cycle.lastCompletedAt;
    if (completedAt == null) return;
    pollHandle = setTimeout(
      requestRefresh,
      Math.max(0, completedAt + freshnessMs - Date.now()),
    );
  };

  const publish = (snapshot: QuotaSnapshot, force = false) => {
    latestSnapshot = snapshot;
    if (!force && snapshot.revision <= lastSeenRevision) return;
    lastSeenRevision = snapshot.revision;
    options.logger.log("snapshot_published", {
      revision: snapshot.revision,
      sourceCount: Object.keys(snapshot.sources).length,
    });
    publishStatus(formatStatus(snapshot));
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        options.logger.log("subscriber_error", { error: String(error) });
      }
    }
    scheduleNext(snapshot);
  };

  const load = async () => {
    latestSnapshot = (await snapshotStore.load()) ?? emptySnapshot();
    return latestSnapshot;
  };

  const runSource = async (input: SourceInput, signal: AbortSignal) => {
    const adapter = adapters.get(input.providerId);
    if (!adapter) return null;
    const descriptor = adapter.describe(input);
    if (input.configFingerprint)
      descriptor.configFingerprint = input.configFingerprint;
    let result: AdapterResult = { state: "error", reason: "fetch_failed" };
    let attempts = 0;
    for (let index = 0; index < SOURCE_MAX_ATTEMPTS; index += 1) {
      attempts += 1;
      options.logger.log("source_attempt", {
        providerId: descriptor.identity.providerId,
        sourceId: descriptor.identity.sourceId,
        attempt: attempts,
      });
      try {
        result = await adapter.fetch(input, signal, options.logger);
      } catch (error) {
        result = {
          state: "error",
          reason: "fetch_failed",
          message: String(error),
        };
      }
      if (result.state !== "error" || signal.aborted) break;
      if (attempts < SOURCE_MAX_ATTEMPTS) {
        const ceiling = SOURCE_RETRY_BASE_DELAY_MS * 2 ** (attempts - 1);
        await waitForRetry(Math.floor(Math.random() * ceiling), signal);
      }
    }
    return { descriptor, result, attempts };
  };

  const applyResult = async (
    descriptor: SourceDescriptor,
    result: AdapterResult,
    attempts: number,
  ) => {
    const next = await snapshotStore.mutate((current) => {
      let updated = current;
      if (result.state === "ok") {
        updated = applySourceSuccess(updated, descriptor.identity, {
          now: Date.now(),
          windows: result.windows,
          extras: result.extras,
        });
      } else if (result.state === "skipped") {
        const existing =
          updated.sources[
            `${descriptor.identity.providerId}/${descriptor.identity.sourceId}`
          ];
        updated = existing?.windows
          ? recordConfigConflict(updated, descriptor.identity, {
              reason: result.reason,
            })
          : applySourceFailure(updated, descriptor.identity, {
              now: Date.now(),
              reason: result.reason,
              attempts: 0,
              message: result.reason,
            });
      } else {
        updated = applySourceFailure(updated, descriptor.identity, {
          now: Date.now(),
          reason: result.reason,
          attempts,
          message: result.message,
        });
      }
      return expireOldObservations(updated, { now: Date.now() });
    });
    publish(next);
  };

  const refresh = async (): Promise<boolean> => {
    if (stopped) return false;
    const controller = new AbortController();
    activeControllers.add(controller);
    const acquired = await leaseStore.acquire({ ownerId, ttlMs: LEASE_TTL_MS });
    if (!acquired.acquired) {
      options.logger.log("refresh_lease_contended", {
        ownerId: acquired.lease?.ownerId,
        expiresAt: acquired.lease?.expiresAt,
      });
      publish(await load(), true);
      activeControllers.delete(controller);
      return false;
    }
    const lease = acquired.lease;
    options.logger.log("refresh_lease_acquired", {
      refreshId: lease.refreshId,
      expiresAt: lease.expiresAt,
    });
    options.logger.log("refresh_cycle_started", {
      refreshId: lease.refreshId,
      sourceCount: declaredSources.length,
    });
    const cycleStartedAt = Date.now();
    await load();
    const descriptors = declaredSources.flatMap((input) => {
      const adapter = adapters.get(input.providerId);
      if (!adapter) return [];
      const descriptor = adapter.describe(input);
      if (input.configFingerprint)
        descriptor.configFingerprint = input.configFingerprint;
      return [descriptor];
    });
    try {
      const startedSnapshot = await snapshotStore.mutate((current) => ({
        ...reconcileSnapshot(
          expireOldObservations(current, { now: cycleStartedAt }),
          descriptors,
        ),
        cycle: { cycleStartedAt },
      }));
      publish(startedSnapshot);
      await Promise.all(
        declaredSources.map(async (input) => {
          const adapter = adapters.get(input.providerId);
          if (!adapter) return;
          const descriptor = adapter.describe(input);
          if (input.configFingerprint)
            descriptor.configFingerprint = input.configFingerprint;
          const shared =
            startedSnapshot.sources[
              `${descriptor.identity.providerId}/${descriptor.identity.sourceId}`
            ];
          if (
            shared?.windows &&
            shared.configConflict &&
            shared.descriptor.configFingerprint !== descriptor.configFingerprint
          ) {
            options.logger.log(
              "source_skipped_config_conflict",
              descriptor.identity,
            );
            return;
          }
          const source = await runSource(input, controller.signal);
          if (!source) return;
          options.logger.log("source_result", {
            ...source.descriptor.identity,
            state: source.result.state,
            reason:
              source.result.state === "ok" ? undefined : source.result.reason,
            attempts: source.attempts,
          });
          await applyResult(source.descriptor, source.result, source.attempts);
        }),
      );
      const completedAt = Date.now();
      lastRefreshCompletedAt = completedAt;
      const completed = await snapshotStore.mutate((current) => ({
        ...current,
        cycle: { ...current.cycle, lastCompletedAt: completedAt },
      }));
      publish(completed);
      options.logger.log("refresh_cycle_completed", {
        refreshId: lease.refreshId,
        completedAt,
      });
      return true;
    } finally {
      await leaseStore.release(lease.refreshId);
      options.logger.log("refresh_lease_released", {
        refreshId: lease.refreshId,
      });
      controller.abort();
      activeControllers.delete(controller);
    }
  };

  const ensureFresh = async () => {
    const disk = await load();
    const completedAt = disk.cycle.lastCompletedAt ?? 0;
    if (completedAt > 0 && Date.now() - completedAt < freshnessMs) {
      publish(disk, true);
      return false;
    }
    if (
      lastRefreshCompletedAt > 0 &&
      Date.now() - lastRefreshCompletedAt < freshnessMs
    )
      return false;
    return refresh();
  };

  function requestRefresh() {
    if (refreshTask || stopped) return;
    const task = ensureFresh()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (refreshTask === task) refreshTask = undefined;
      });
    refreshTask = task;
  }

  return {
    async start(startOptions) {
      if (started) return;
      started = true;
      stopped = false;
      declaredSources = startOptions.sources;
      activeSource = startOptions.activeSource;
      colorize = startOptions.colorize;
      statusCallbacks.add(startOptions.registerStatus);
      publishStatus(undefined);
      const initial = await load();
      if (Object.keys(initial.sources).length > 0) publish(initial, true);
      else if (declaredSources.length > 0) publishStatus("Quota …");
      watcher = await watchSnapshot({
        snapshotPath: snapshotStore.snapshotPath,
        pollIntervalMs: options.watcherPollIntervalMs,
        onSnapshot: (snapshot) => publish(snapshot),
      });
      requestRefresh();
    },
    setActiveSource(identity) {
      activeSource = identity;
      publishStatus(formatStatus(latestSnapshot));
    },
    onStatus(callback) {
      statusCallbacks.add(callback);
      return { close: () => statusCallbacks.delete(callback) };
    },
    onSnapshot(callback) {
      listeners.add(callback);
      return { close: () => listeners.delete(callback) };
    },
    async read() {
      return (await snapshotStore.load()) ?? latestSnapshot;
    },
    async shutdown() {
      if (stopped) return;
      stopped = true;
      if (pollHandle) clearTimeout(pollHandle);
      watcher?.close();
      watcher = undefined;
      for (const controller of activeControllers) controller.abort();
      await refreshTask;
      activeControllers.clear();
      publishStatus(undefined);
      statusCallbacks.clear();
      listeners.clear();
    },
  };
}
