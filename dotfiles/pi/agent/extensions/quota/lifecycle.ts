import { type AdapterLogger } from "./adapter-registry.js";
import {
  createCoordinator,
  type Coordinator,
  type SourceInput,
} from "./coordinator.js";
import { setLeaseDirectory } from "./refresh-lease.js";
import {
  quotaSnapshotPath,
  quotaStateDir,
  resetSnapshotStore,
} from "./snapshot-store.js";
import { watchSnapshot, type WatcherSubscription } from "./snapshot-watcher.js";
import type { QuotaSnapshot, SourceIdentity } from "./snapshot.js";
import { formatCompactStatus } from "./status-formatter.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FRESHNESS_MS = 5 * 60 * 1000;
const STATUS_FALLBACK = " ";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuotaLifecycleOptions = {
  stateDir?: string;
  lockDir?: string;
  leaseDir?: string;
  logger: AdapterLogger;
  freshnessMs?: number;
};

export type QuotaLifecycle = {
  start(options: {
    sources: SourceInput[];
    registerStatus: (value: string | undefined) => void;
    activeSource?: SourceIdentity;
  }): Promise<void>;
  setActiveSource(identity: SourceIdentity | undefined): void;
  onStatus(callback: (value: string | undefined) => void): void;
  onSnapshot(callback: (snapshot: QuotaSnapshot) => void): void;
  read(): Promise<QuotaSnapshot>;
  shutdown(): Promise<void>;
  /** Internal access for tests and orchestration layers. */
  coordinator(): Coordinator;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatQuota(
  snapshot: QuotaSnapshot,
  activeSource: SourceIdentity | undefined,
): string {
  const value = formatCompactStatus(snapshot, { activeSource });
  return value || STATUS_FALLBACK;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createQuotaLifecycle(
  options: QuotaLifecycleOptions,
): QuotaLifecycle {
  const stateDir = options.stateDir ?? quotaStateDir();
  resetSnapshotStore({ stateDir, lockDir: options.lockDir });
  if (options.leaseDir) setLeaseDirectory(options.leaseDir);

  const freshnessMs = options.freshnessMs ?? DEFAULT_FRESHNESS_MS;
  const coordinator: Coordinator = createCoordinator({
    stateDir,
    lockDir: options.lockDir,
    leaseDir: options.leaseDir,
    logger: options.logger,
    freshnessMs,
  });

  let pollHandle: ReturnType<typeof setTimeout> | undefined;
  let refreshTask: Promise<void> | undefined;
  let watcher: WatcherSubscription | undefined;
  let subscribed = false;
  let activeSource: SourceIdentity | undefined;
  let declaredSources: SourceInput[] = [];
  let latestSnapshot: QuotaSnapshot | undefined;
  let lastSeenRevision = -1;
  const statusCallbacks = new Set<(value: string | undefined) => void>();
  const snapshotCallbacks = new Set<(snapshot: QuotaSnapshot) => void>();

  const publishStatus = (value: string | undefined) => {
    for (const cb of statusCallbacks) {
      try {
        cb(value);
      } catch {
        // ignore subscriber errors
      }
    }
  };

  const publishSnapshot = (snapshot: QuotaSnapshot) => {
    for (const cb of snapshotCallbacks) {
      try {
        cb(snapshot);
      } catch {
        // ignore subscriber errors
      }
    }
  };

  const onSnapshot = (snapshot: QuotaSnapshot) => {
    if (snapshot.revision <= lastSeenRevision) return;
    lastSeenRevision = snapshot.revision;
    latestSnapshot = snapshot;
    publishStatus(formatQuota(snapshot, activeSource));
    publishSnapshot(snapshot);
    scheduleNext(snapshot);
  };

  const requestRefresh = () => {
    if (refreshTask) return;
    const task = coordinator
      .ensureFresh(declaredSources)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (refreshTask === task) refreshTask = undefined;
      });
    refreshTask = task;
  };

  const scheduleNext = (snapshot: QuotaSnapshot) => {
    if (pollHandle) clearTimeout(pollHandle);
    const completedAt = snapshot.cycle.lastCompletedAt;
    if (completedAt == null) return;
    const dueAt = completedAt + freshnessMs;
    const delay = Math.max(0, dueAt - Date.now());
    pollHandle = setTimeout(requestRefresh, delay);
  };

  return {
    async start({ sources, registerStatus, activeSource: initialActive }) {
      activeSource = initialActive;
      declaredSources = sources;
      statusCallbacks.add(registerStatus);
      publishStatus(undefined);
      if (!subscribed) {
        coordinator.subscribe(onSnapshot);
        subscribed = true;
      }
      const initial = await coordinator.read();
      if (Object.keys(initial.sources).length > 0) {
        onSnapshot(initial);
      } else if (sources.length > 0) {
        publishStatus("Quota …");
      }
      watcher = await watchSnapshot({
        snapshotPath: quotaSnapshotPath(stateDir),
        onSnapshot,
      });
      requestRefresh();
    },
    setActiveSource(identity) {
      activeSource = identity;
      if (latestSnapshot) {
        publishStatus(formatQuota(latestSnapshot, activeSource));
      } else {
        void coordinator
          .read()
          .then((snapshot) => {
            onSnapshot(snapshot);
          })
          .catch(() => undefined);
      }
    },
    onStatus(callback) {
      statusCallbacks.add(callback);
    },
    onSnapshot(callback) {
      snapshotCallbacks.add(callback);
    },
    read() {
      return coordinator.read();
    },
    coordinator() {
      return coordinator;
    },
    async shutdown() {
      if (pollHandle) clearTimeout(pollHandle);
      watcher?.close();
      watcher = undefined;
      publishStatus(undefined);
      await coordinator.shutdown();
      await refreshTask;
      statusCallbacks.clear();
      snapshotCallbacks.clear();
    },
  };
}
