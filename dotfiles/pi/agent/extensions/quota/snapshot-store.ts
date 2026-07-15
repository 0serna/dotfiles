import {
  chmod,
  mkdir,
  open,
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

const STATE_DIR_NAME = "quota";
const SNAPSHOT_FILE = "snapshot.json";
const LOCK_DIR_NAME = "locks";
const SNAPSHOT_MUTEX_FILE = "snapshot.mutex";
const SNAPSHOT_MUTEX_STALE_MS = 5_000;
const LOCK_RETRY_DELAY_MS = 5;
const LOCK_DEFAULT_TIMEOUT_MS = 5_000;
const PRIVATE_PERMISSIONS = 0o700;
const PRIVATE_FILE_PERMISSIONS = 0o600;

export type SnapshotStore = {
  readonly snapshotPath: string;
  readonly lockPath: string;
  load(): Promise<QuotaSnapshot | null>;
  write(snapshot: QuotaSnapshot): Promise<void>;
  mutate(
    transition: (current: QuotaSnapshot) => QuotaSnapshot,
  ): Promise<QuotaSnapshot>;
  withLock<T>(
    operation: () => Promise<T>,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<T>;
};

export function quotaStateDir(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir(),
): string {
  const xdg = env.XDG_STATE_HOME?.trim();
  return xdg
    ? join(xdg, "pi", STATE_DIR_NAME)
    : join(home, ".local", "state", "pi", STATE_DIR_NAME);
}

export function quotaSnapshotPath(stateDir: string): string {
  return join(stateDir, SNAPSHOT_FILE);
}

export function emptySnapshot(): QuotaSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    revision: 0,
    cycle: { cycleStartedAt: 0 },
    sources: {},
  };
}

function isValidSourceRecord(value: unknown): value is SourceRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<SourceRecord>;
  return Boolean(
    record.identity &&
    typeof record.identity.providerId === "string" &&
    typeof record.identity.sourceId === "string" &&
    typeof record.state === "string" &&
    typeof record.observedAt === "number" &&
    typeof record.lastSuccessAt === "number",
  );
}

function isValidShape(value: unknown): value is QuotaSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<QuotaSnapshot>;
  return Boolean(
    snapshot.version === SNAPSHOT_VERSION &&
    typeof snapshot.revision === "number" &&
    snapshot.revision >= 0 &&
    snapshot.cycle &&
    typeof snapshot.cycle.cycleStartedAt === "number" &&
    snapshot.sources &&
    Object.values(snapshot.sources).every(isValidSourceRecord),
  );
}

export async function readSnapshotFile(
  path: string,
): Promise<QuotaSnapshot | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return isValidShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createSnapshotStore(options: {
  stateDir: string;
  lockDir?: string;
}): SnapshotStore {
  const stateDir = options.stateDir;
  const lockDir = options.lockDir ?? join(stateDir, LOCK_DIR_NAME);
  const snapshotPath = quotaSnapshotPath(stateDir);
  const lockPath = join(lockDir, SNAPSHOT_MUTEX_FILE);

  const write = async (snapshot: QuotaSnapshot): Promise<void> => {
    await mkdir(stateDir, { recursive: true, mode: PRIVATE_PERMISSIONS });
    await chmod(stateDir, PRIVATE_PERMISSIONS).catch(() => undefined);
    const temporaryPath = `${snapshotPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(snapshot), {
      mode: PRIVATE_FILE_PERMISSIONS,
    });
    await chmod(temporaryPath, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
    await rename(temporaryPath, snapshotPath);
    await chmod(snapshotPath, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
  };

  const withLock = async <T>(
    operation: () => Promise<T>,
    lockOptions: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<T> => {
    await mkdir(lockDir, { recursive: true, mode: PRIVATE_PERMISSIONS });
    const deadline =
      Date.now() + (lockOptions.timeoutMs ?? LOCK_DEFAULT_TIMEOUT_MS);
    let acquired = false;
    while (Date.now() < deadline) {
      if (lockOptions.signal?.aborted) throw new Error("snapshot lock aborted");
      try {
        const handle = await open(lockPath, "wx", PRIVATE_FILE_PERMISSIONS);
        await handle.close();
        acquired = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const metadata = await stat(lockPath).catch(() => null);
        if (
          metadata &&
          Date.now() - metadata.mtimeMs > SNAPSHOT_MUTEX_STALE_MS
        ) {
          await unlink(lockPath).catch(() => undefined);
          continue;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, LOCK_RETRY_DELAY_MS),
        );
      }
    }
    if (!acquired) throw new Error("snapshot lock timeout");
    try {
      return await operation();
    } finally {
      await unlink(lockPath).catch(() => undefined);
    }
  };

  const load = () => readSnapshotFile(snapshotPath);
  const mutate = (transition: (current: QuotaSnapshot) => QuotaSnapshot) =>
    withLock(async () => {
      const current = (await load()) ?? emptySnapshot();
      const candidate = transition(current);
      if (candidate === current) return current;
      const next = { ...candidate, revision: current.revision + 1 };
      await write(next);
      return next;
    });

  return { snapshotPath, lockPath, load, write, mutate, withLock };
}
