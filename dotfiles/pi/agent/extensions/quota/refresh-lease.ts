import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

const LEASE_FILE = "refresh-lease.json";
const LEASE_MUTEX_FILE = "refresh-lease.mutex";
const LEASE_MUTEX_STALE_MS = 5_000;
const LEASE_MUTEX_TIMEOUT_MS = 5_000;
const PRIVATE_PERMISSIONS = 0o700;
const PRIVATE_FILE_PERMISSIONS = 0o600;

export type RefreshLease = {
  ownerId: string;
  refreshId: string;
  expiresAt: number;
};
export type AcquireResult =
  | { acquired: true; lease: RefreshLease }
  | { acquired: false; lease?: RefreshLease };

export type RefreshLeaseStore = {
  readonly leasePath: string;
  read(): Promise<RefreshLease | null>;
  acquire(options: { ownerId: string; ttlMs: number }): Promise<AcquireResult>;
  release(refreshId: string): Promise<void>;
};

function isValidLease(value: unknown): value is RefreshLease {
  if (typeof value !== "object" || value === null) return false;
  const lease = value as Partial<RefreshLease>;
  return (
    typeof lease.ownerId === "string" &&
    typeof lease.refreshId === "string" &&
    typeof lease.expiresAt === "number"
  );
}

async function readLeaseFile(path: string): Promise<RefreshLease | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return isValidLease(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createRefreshLeaseStore(directory: string): RefreshLeaseStore {
  const leasePath = join(directory, LEASE_FILE);
  const mutexPath = join(directory, LEASE_MUTEX_FILE);

  const withMutex = async <T>(operation: () => Promise<T>): Promise<T> => {
    await mkdir(directory, { recursive: true, mode: PRIVATE_PERMISSIONS });
    const deadline = Date.now() + LEASE_MUTEX_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const handle = await open(mutexPath, "wx", PRIVATE_FILE_PERMISSIONS);
        await handle.close();
        try {
          return await operation();
        } finally {
          await unlink(mutexPath).catch(() => undefined);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const metadata = await stat(mutexPath).catch(() => null);
        if (metadata && Date.now() - metadata.mtimeMs > LEASE_MUTEX_STALE_MS) {
          await unlink(mutexPath).catch(() => undefined);
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    throw new Error("refresh lease mutex timeout");
  };

  const read = async (): Promise<RefreshLease | null> => {
    const lease = await readLeaseFile(leasePath);
    return lease && lease.expiresAt > Date.now() ? lease : null;
  };

  return {
    leasePath,
    read,
    acquire: (options) =>
      withMutex(async () => {
        const now = Date.now();
        const current = await readLeaseFile(leasePath);
        if (current && current.expiresAt > now)
          return { acquired: false, lease: current };
        if (current) await unlink(leasePath).catch(() => undefined);
        const lease: RefreshLease = {
          ownerId: options.ownerId,
          refreshId: randomBytes(16).toString("hex"),
          expiresAt: now + options.ttlMs,
        };
        const handle = await open(leasePath, "wx", PRIVATE_FILE_PERMISSIONS);
        try {
          await handle.writeFile(JSON.stringify(lease));
          await handle.sync();
        } finally {
          await handle.close();
        }
        await chmod(leasePath, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
        return { acquired: true, lease };
      }),
    release: (refreshId) =>
      withMutex(async () => {
        const current = await readLeaseFile(leasePath);
        if (current?.refreshId === refreshId)
          await unlink(leasePath).catch(() => undefined);
      }),
  };
}
