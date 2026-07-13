import { randomBytes } from "node:crypto";
import { join as pathJoin } from "node:path";
import {
  type AdapterFetchInput,
  type AdapterLogger,
  type AdapterResult,
  getAdapter,
  listAdapters,
  type QuotaAdapter,
  registerAdapter,
  resetAdapterRegistry,
} from "./adapter-registry.js";
import { reconcileSnapshot } from "./config-fingerprint.js";
import {
  acquireRefreshLease,
  releaseRefreshLease,
  setLeaseDirectory,
} from "./refresh-lease.js";
import {
  emptySnapshot,
  loadSnapshot,
  mutateSnapshot,
  quotaStateDir,
  resetSnapshotStore,
} from "./snapshot-store.js";
import {
  applySourceFailure,
  applySourceSuccess,
  expireOldObservations,
  markExhausted,
  recordConfigConflict,
} from "./snapshot-transitions.js";
import {
  type QuotaSnapshot,
  type SourceDescriptor,
  type SourceExhaustion,
  type SourceIdentity,
} from "./snapshot.js";

export { getAdapter, listAdapters, registerAdapter, resetAdapterRegistry };
export type { QuotaAdapter };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;
const LEASE_TTL_MS = 60_000;
const SOURCE_MAX_ATTEMPTS = 3;
const SOURCE_RETRY_BASE_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuotaCoordinatorOptions = {
  /** Path to the snapshot file directory. */
  stateDir?: string;
  /** Backwards-compatible alias for stateDir. */
  snapshotDir?: string;
  /** Lock directory used by withSnapshotLock. */
  lockDir?: string;
  /** Lease directory used by acquireRefreshLease. */
  leaseDir?: string;
  logger: AdapterLogger;
  /** Freshness threshold for an ensure-fresh refresh. */
  freshnessMs?: number;
};

export type SourceInput = AdapterFetchInput;

export type Coordinator = {
  read(): Promise<QuotaSnapshot>;
  refresh(inputs: SourceInput[]): Promise<boolean>;
  ensureFresh(inputs: SourceInput[]): Promise<{ refreshed: boolean }>;
  recordExhaustion(
    identity: SourceIdentity,
    exhaustion: SourceExhaustion,
  ): Promise<void>;
  subscribe(listener: (snapshot: QuotaSnapshot) => void): { close: () => void };
  shutdown(): Promise<void>;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return;
  const combined = AbortSignal.any([signal, AbortSignal.timeout(ms)]);
  if (combined.aborted) return;
  await new Promise<void>((resolve) => {
    combined.addEventListener("abort", () => resolve(), { once: true });
  });
}

export function createCoordinator(
  options: QuotaCoordinatorOptions,
): Coordinator {
  const logger = options.logger;
  const stateDir = options.stateDir ?? options.snapshotDir ?? quotaStateDir();
  if (options.stateDir || options.snapshotDir) {
    resetSnapshotStore({ stateDir, lockDir: options.lockDir });
  }
  const leaseDir = options.leaseDir ?? pathJoin(stateDir, "lease");
  setLeaseDirectory(leaseDir);

  const freshnessMs = options.freshnessMs ?? DEFAULT_FRESHNESS_MS;

  const listeners = new Set<(snapshot: QuotaSnapshot) => void>();
  const activeControllers = new Set<AbortController>();
  let cachedSnapshot: QuotaSnapshot = emptySnapshot();
  let inMemory: QuotaSnapshot = emptySnapshot();
  let lastRefreshCompletedAt = 0;
  const cycleId = randomBytes(8).toString("hex");

  const loadFromDisk = async (): Promise<QuotaSnapshot> => {
    const loaded = await loadSnapshot();
    if (loaded) {
      cachedSnapshot = loaded;
      inMemory = loaded;
      return loaded;
    }
    cachedSnapshot = emptySnapshot();
    inMemory = cachedSnapshot;
    return cachedSnapshot;
  };

  const emit = (snapshot: QuotaSnapshot) => {
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        logger.log("subscriber_error", { error: String(error) });
      }
    }
  };

  const publish = (snapshot: QuotaSnapshot) => {
    inMemory = snapshot;
    cachedSnapshot = snapshot;
    logger.log("snapshot_published", {
      revision: snapshot.revision,
      sourceCount: Object.keys(snapshot.sources).length,
    });
    emit(snapshot);
  };

  const recordExhaustion = async (
    identity: SourceIdentity,
    exhaustion: SourceExhaustion,
  ): Promise<void> => {
    const next = await mutateSnapshot((current) =>
      markExhausted(current, identity, exhaustion),
    );
    publish(next);
  };

  const runSource = async (
    input: SourceInput,
    signal: AbortSignal,
  ): Promise<{
    descriptor: SourceDescriptor;
    result: AdapterResult;
    attempts: number;
  } | null> => {
    const adapter = getAdapter(input.providerId);
    if (!adapter) return null;

    const descriptor = adapter.describe(input);
    if (input.configFingerprint) {
      descriptor.configFingerprint = input.configFingerprint;
    }
    let attempts = 0;
    let lastResult: AdapterResult = {
      state: "error",
      reason: "fetch_failed",
    };
    for (let i = 0; i < SOURCE_MAX_ATTEMPTS; i++) {
      attempts += 1;
      logger.log("source_attempt", {
        providerId: descriptor.identity.providerId,
        sourceId: descriptor.identity.sourceId,
        attempt: attempts,
      });
      try {
        lastResult = await adapter.fetch(input, signal, options.logger);
      } catch (error) {
        lastResult = {
          state: "error",
          reason: "fetch_failed",
          message: String(error),
        };
      }
      if (lastResult.state !== "error" || signal.aborted) {
        return { descriptor, result: lastResult, attempts };
      }
      if (attempts < SOURCE_MAX_ATTEMPTS) {
        const backoffCeiling = SOURCE_RETRY_BASE_DELAY_MS * 2 ** (attempts - 1);
        const delayMs = Math.floor(Math.random() * backoffCeiling);
        await waitForRetry(delayMs, signal);
        if (signal.aborted) {
          return { descriptor, result: lastResult, attempts };
        }
      }
    }
    return { descriptor, result: lastResult, attempts };
  };

  const applyResult = async (
    descriptor: SourceDescriptor,
    result: AdapterResult,
    attempts: number,
  ): Promise<void> => {
    const next = await mutateSnapshot((current) => {
      let updated = current;
      if (result.state === "ok") {
        updated = applySourceSuccess(updated, descriptor.identity, {
          now: Date.now(),
          windows: result.windows,
          extras: result.extras,
        });
      } else if (result.state === "skipped") {
        const key = `${descriptor.identity.providerId}/${descriptor.identity.sourceId}`;
        const existing = updated.sources[key];
        if (existing?.windows) {
          updated = recordConfigConflict(updated, descriptor.identity, {
            reason: result.reason,
          });
          logger.log("configuration_conflict", {
            providerId: descriptor.identity.providerId,
            sourceId: descriptor.identity.sourceId,
            reason: result.reason,
          });
        } else {
          updated = applySourceFailure(updated, descriptor.identity, {
            now: Date.now(),
            reason: result.reason,
            attempts: 0,
            message: result.reason,
          });
        }
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
    const record =
      next.sources[
        `${descriptor.identity.providerId}/${descriptor.identity.sourceId}`
      ];
    if (record?.state === "degraded") {
      logger.log("source_degraded", {
        providerId: descriptor.identity.providerId,
        sourceId: descriptor.identity.sourceId,
        reason: record.failure?.reason,
      });
    } else if (record?.state === "expired") {
      logger.log("source_expired", {
        providerId: descriptor.identity.providerId,
        sourceId: descriptor.identity.sourceId,
      });
    }
  };

  const refresh = async (inputs: SourceInput[]): Promise<boolean> => {
    const controller = new AbortController();
    activeControllers.add(controller);
    const acquired = await acquireRefreshLease({
      ownerId: cycleId,
      ttlMs: LEASE_TTL_MS,
    });
    if (!acquired.acquired) {
      logger.log("refresh_lease_contended", {
        ownerId: acquired.lease?.ownerId,
        expiresAt: acquired.lease?.expiresAt,
      });
      inMemory = await loadFromDisk();
      emit(inMemory);
      activeControllers.delete(controller);
      return false;
    }
    const lease = acquired.lease;
    logger.log("refresh_lease_acquired", {
      refreshId: lease.refreshId,
      expiresAt: lease.expiresAt,
    });
    logger.log("refresh_cycle_started", {
      refreshId: lease.refreshId,
      sourceCount: inputs.length,
    });

    await loadFromDisk();
    const cycleStartedAt = Date.now();

    const descriptors: SourceDescriptor[] = [];
    for (const input of inputs) {
      const adapter = getAdapter(input.providerId);
      if (!adapter) continue;
      const descriptor = adapter.describe(input);
      if (input.configFingerprint) {
        descriptor.configFingerprint = input.configFingerprint;
      }
      descriptors.push(descriptor);
    }

    try {
      const expiredSources: SourceIdentity[] = [];
      const started = await mutateSnapshot((current) => {
        const expired = expireOldObservations(current, {
          now: cycleStartedAt,
        });
        for (const [key, record] of Object.entries(expired.sources)) {
          if (
            record.state === "expired" &&
            current.sources[key]?.state !== "expired"
          ) {
            expiredSources.push(record.identity);
          }
        }
        const reconciled = reconcileSnapshot(expired, descriptors);
        return {
          ...reconciled,
          cycle: { cycleStartedAt },
        };
      });
      publish(started);
      for (const identity of expiredSources) {
        logger.log("source_expired", identity);
      }

      await Promise.all(
        inputs.map(async (input) => {
          const adapter = getAdapter(input.providerId);
          if (!adapter) return;
          const localDescriptor = adapter.describe(input);
          if (input.configFingerprint) {
            localDescriptor.configFingerprint = input.configFingerprint;
          }
          const shared =
            started.sources[
              `${localDescriptor.identity.providerId}/${localDescriptor.identity.sourceId}`
            ];
          if (
            shared?.windows &&
            shared.configConflict &&
            shared.descriptor.configFingerprint !==
              localDescriptor.configFingerprint
          ) {
            logger.log("source_skipped_config_conflict", {
              providerId: localDescriptor.identity.providerId,
              sourceId: localDescriptor.identity.sourceId,
            });
            return;
          }

          const result = await runSource(input, controller.signal);
          if (!result) return;
          logger.log("source_result", {
            providerId: result.descriptor.identity.providerId,
            sourceId: result.descriptor.identity.sourceId,
            state: result.result.state,
            reason:
              result.result.state === "ok" ? undefined : result.result.reason,
            attempts: result.attempts,
          });
          await applyResult(result.descriptor, result.result, result.attempts);
        }),
      );

      const completedAt = Date.now();
      lastRefreshCompletedAt = completedAt;
      const completed = await mutateSnapshot((current) => ({
        ...current,
        cycle: { ...current.cycle, lastCompletedAt: completedAt },
      }));
      publish(completed);
      logger.log("refresh_cycle_completed", {
        refreshId: lease.refreshId,
        completedAt,
      });
      return true;
    } finally {
      await releaseRefreshLease(lease.refreshId);
      logger.log("refresh_lease_released", { refreshId: lease.refreshId });
      controller.abort();
      activeControllers.delete(controller);
    }
  };

  const ensureFresh = async (
    inputs: SourceInput[],
  ): Promise<{ refreshed: boolean }> => {
    const disk = await loadFromDisk();
    const diskCompletedAt = disk.cycle.lastCompletedAt ?? 0;
    if (diskCompletedAt > 0 && Date.now() - diskCompletedAt < freshnessMs) {
      cachedSnapshot = disk;
      inMemory = disk;
      return { refreshed: false };
    }
    if (
      lastRefreshCompletedAt > 0 &&
      Date.now() - lastRefreshCompletedAt < freshnessMs
    ) {
      return { refreshed: false };
    }
    const refreshed = await refresh(inputs);
    return { refreshed };
  };

  return {
    async read() {
      return loadFromDisk();
    },
    refresh,
    ensureFresh,
    recordExhaustion,
    subscribe(listener) {
      listeners.add(listener);
      return {
        close() {
          listeners.delete(listener);
        },
      };
    },
    async shutdown() {
      for (const controller of activeControllers) controller.abort();
      activeControllers.clear();
      listeners.clear();
    },
  };
}
