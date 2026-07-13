import type { FSWatcher } from "node:fs";
import { watch as fsWatch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { readSnapshotFile } from "./snapshot-store.js";
import type { QuotaSnapshot } from "./snapshot.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WatcherOptions = {
  snapshotPath: string;
  onSnapshot: (snapshot: QuotaSnapshot) => void;
  debounceMs?: number;
  /** Optional periodic reread interval in ms. */
  pollIntervalMs?: number;
  /** When true, attempt to use the directory watcher. */
  watchEnabled?: boolean;
};

export type WatcherSubscription = {
  close: () => void;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Watch a snapshot file and emit validated revisions. A debounce timer
 * coalesces burst events, and a periodic poll acts as a safety net for
 * lost filesystem events.
 */
export async function watchSnapshot(
  options: WatcherOptions,
): Promise<WatcherSubscription> {
  const debounceMs = options.debounceMs ?? 50;
  const watchEnabled = options.watchEnabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 60_000;
  const directory = dirname(options.snapshotPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  let closed = false;
  let lastEmittedRevision = -1;
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;
  let pollHandle: ReturnType<typeof setInterval> | undefined;
  let watcher: FSWatcher | undefined;

  const emit = (snapshot: QuotaSnapshot) => {
    if (snapshot.revision <= lastEmittedRevision) return;
    lastEmittedRevision = snapshot.revision;
    options.onSnapshot(snapshot);
  };

  const reload = async () => {
    if (closed) return;
    const snapshot = await readSnapshotFile(options.snapshotPath);
    if (snapshot) emit(snapshot);
  };

  const schedule = () => {
    if (closed) return;
    if (debounceHandle) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      void reload();
    }, debounceMs);
  };

  if (watchEnabled) {
    try {
      watcher = fsWatch(directory, { persistent: false }, () => {
        schedule();
      });
      watcher.on("error", () => {
        // Watcher errored; periodic poll remains active.
      });
    } catch {
      // Ignore watcher setup errors; periodic poll still applies.
    }
  }

  if (pollIntervalMs > 0) {
    pollHandle = setInterval(() => {
      void reload();
    }, pollIntervalMs);
  }

  // Initial read.
  await reload();

  return {
    close: () => {
      closed = true;
      if (debounceHandle) clearTimeout(debounceHandle);
      if (pollHandle) clearInterval(pollHandle);
      watcher?.close();
    },
  };
}
