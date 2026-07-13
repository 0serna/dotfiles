import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  SNAPSHOT_VERSION,
  type QuotaSnapshot,
  type SourceRecord,
} from "./snapshot.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_DIR_NAME = "quota";
const SNAPSHOT_FILE = "snapshot.json";
const LOCK_DIR_NAME = "locks";
const SNAPSHOT_MUTEX_FILE = "snapshot.mutex";
const SNAPSHOT_MUTEX_STALE_MS = 5_000;
const PRIVATE_PERMISSIONS = 0o700;
const PRIVATE_FILE_PERMISSIONS = 0o600;

// ---------------------------------------------------------------------------
// Configurable state directory
// ---------------------------------------------------------------------------

let stateDirOverride: string | undefined;
let lockDirOverride: string | undefined;

/**
 * Compute the user state directory used for quota persistence. Honors
 * `XDG_STATE_HOME` and falls back to `~/.local/state/pi/quota`.
 */
export function quotaStateDir(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): string {
  const xdg = env.XDG_STATE_HOME?.trim();
  if (xdg) return join(xdg, "pi", STATE_DIR_NAME);
  return join(home, ".local", "state", "pi", STATE_DIR_NAME);
}

function defaultLockDir(stateDir: string): string {
  return join(stateDir, LOCK_DIR_NAME);
}

function resolveStateDir(): string {
  return stateDirOverride ?? quotaStateDir();
}

function resolveLockDir(): string {
  return lockDirOverride ?? defaultLockDir(resolveStateDir());
}

/** Override the directories used for snapshot and lock files. */
export function resetSnapshotStore(options?: {
  stateDir?: string;
  lockDir?: string;
}): void {
  stateDirOverride = options?.stateDir;
  lockDirOverride = options?.lockDir;
}

export function quotaSnapshotPath(
  stateDir: string = resolveStateDir(),
): string {
  return join(stateDir, SNAPSHOT_FILE);
}

// ---------------------------------------------------------------------------
// Empty snapshot
// ---------------------------------------------------------------------------

/** Create an empty snapshot with the current schema version. */
export function emptySnapshot(): QuotaSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    revision: 0,
    cycle: { cycleStartedAt: 0 },
    sources: {},
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidShape(value: unknown): value is QuotaSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<QuotaSnapshot>;
  if (snapshot.version !== SNAPSHOT_VERSION) return false;
  if (typeof snapshot.revision !== "number" || snapshot.revision < 0) {
    return false;
  }
  if (!snapshot.cycle || typeof snapshot.cycle !== "object") return false;
  if (typeof snapshot.cycle.cycleStartedAt !== "number") return false;
  if (!snapshot.sources || typeof snapshot.sources !== "object") return false;
  for (const source of Object.values(snapshot.sources)) {
    if (!isValidSourceRecord(source)) return false;
  }
  return true;
}

function isValidSourceRecord(value: unknown): value is SourceRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<SourceRecord>;
  if (!record.identity || typeof record.identity !== "object") return false;
  const identity = record.identity;
  if (
    typeof identity.providerId !== "string" ||
    typeof identity.sourceId !== "string"
  ) {
    return false;
  }
  if (typeof record.state !== "string") return false;
  if (typeof record.observedAt !== "number") return false;
  if (typeof record.lastSuccessAt !== "number") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/**
 * Read a snapshot from a given file path. Returns null when the file is
 * missing, unreadable, or fails schema validation.
 */
export async function readSnapshotFile(
  path: string,
): Promise<QuotaSnapshot | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isValidShape(parsed)) return null;
  return parsed;
}

/**
 * Read the latest snapshot from the configured state directory. Returns
 * `null` when no valid snapshot is present.
 */
export async function loadSnapshot(): Promise<QuotaSnapshot | null> {
  return readSnapshotFile(quotaSnapshotPath());
}

/**
 * Persist a snapshot atomically under the configured state directory. Writes
 * to a temporary file, fsync's the parent directory, then renames.
 */
export async function writeSnapshot(snapshot: QuotaSnapshot): Promise<void> {
  const stateDir = resolveStateDir();
  const file = quotaSnapshotPath(stateDir);
  await mkdir(stateDir, { recursive: true, mode: PRIVATE_PERMISSIONS });
  await chmod(stateDir, PRIVATE_PERMISSIONS).catch(() => undefined);

  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(snapshot), {
    mode: PRIVATE_FILE_PERMISSIONS,
  });
  await chmod(temp, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
  await rename(temp, file);
  await chmod(file, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
}

/**
 * Apply a read-modify-write transition while holding the cross-process lock.
 * The store owns the persisted revision so concurrent callers cannot publish
 * the same or an older revision.
 */
export async function mutateSnapshot(
  transition: (current: QuotaSnapshot) => QuotaSnapshot,
): Promise<QuotaSnapshot> {
  return withSnapshotLock(async () => {
    const current = (await loadSnapshot()) ?? emptySnapshot();
    const candidate = transition(current);
    if (candidate === current) return current;
    const next = { ...candidate, revision: current.revision + 1 };
    await writeSnapshot(next);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Snapshot-mutation lock
// ---------------------------------------------------------------------------

const LOCK_RETRY_DELAY_MS = 5;
const LOCK_DEFAULT_TIMEOUT_MS = 5_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `operation` while holding the snapshot-mutation lock. The lock file is
 * created with `O_EXCL` semantics; contenders busy-wait until the lock is
 * released or the timeout elapses.
 */
export async function withSnapshotLock<T>(
  operation: () => Promise<T>,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const lockDir = resolveLockDir();
  await mkdir(lockDir, { recursive: true, mode: PRIVATE_PERMISSIONS });
  const lockFile = join(lockDir, SNAPSHOT_MUTEX_FILE);

  const deadline = Date.now() + (options.timeoutMs ?? LOCK_DEFAULT_TIMEOUT_MS);
  let acquired = false;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      throw new Error("snapshot lock aborted");
    }
    try {
      const handle = await import("node:fs/promises").then((m) =>
        m.open(lockFile, "wx", PRIVATE_FILE_PERMISSIONS),
      );
      await handle.close();
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const metadata = await stat(lockFile).catch(() => null);
      if (metadata && Date.now() - metadata.mtimeMs > SNAPSHOT_MUTEX_STALE_MS) {
        await unlink(lockFile).catch(() => undefined);
        continue;
      }
      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }

  if (!acquired) {
    throw new Error("snapshot lock timeout");
  }

  try {
    return await operation();
  } finally {
    await unlink(lockFile).catch(() => undefined);
  }
}

export { exists };
