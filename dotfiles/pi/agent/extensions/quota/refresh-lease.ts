import { randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEASE_FILE = "refresh-lease.json";
const LEASE_MUTEX_FILE = "refresh-lease.mutex";
const LEASE_MUTEX_STALE_MS = 5_000;
const LEASE_MUTEX_TIMEOUT_MS = 5_000;
const PRIVATE_PERMISSIONS = 0o700;
const PRIVATE_FILE_PERMISSIONS = 0o600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RefreshLease = {
  ownerId: string;
  refreshId: string;
  /** Absolute expiry timestamp in milliseconds. */
  expiresAt: number;
};

export type AcquireResult =
  | { acquired: true; lease: RefreshLease }
  | { acquired: false; lease?: RefreshLease };

// ---------------------------------------------------------------------------
// Configurable lease directory
// ---------------------------------------------------------------------------

let leaseDirOverride: string | undefined;

export function setLeaseDirectory(path: string | undefined): void {
  leaseDirOverride = path;
}

function resolveLeaseDir(): string {
  if (leaseDirOverride) return leaseDirOverride;
  // Fall back to the snapshot store's lock dir? The lease belongs to the
  // quota state directory tree, so we recompute the same path here.
  // Callers are expected to call setLeaseDirectory with an explicit path.
  throw new Error("lease directory is not configured");
}

function leasePath(): string {
  return join(resolveLeaseDir(), LEASE_FILE);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpired(lease: RefreshLease, now: number): boolean {
  return lease.expiresAt <= now;
}

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
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return isValidLease(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function createLeaseFile(
  path: string,
  lease: RefreshLease,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: PRIVATE_PERMISSIONS });
  const handle = await open(path, "wx", PRIVATE_FILE_PERMISSIONS);
  try {
    await handle.writeFile(JSON.stringify(lease));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, PRIVATE_FILE_PERMISSIONS).catch(() => undefined);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLeaseMutex<T>(operation: () => Promise<T>): Promise<T> {
  const directory = resolveLeaseDir();
  await mkdir(directory, { recursive: true, mode: PRIVATE_PERMISSIONS });
  const mutex = join(directory, LEASE_MUTEX_FILE);
  const deadline = Date.now() + LEASE_MUTEX_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const handle = await open(mutex, "wx", PRIVATE_FILE_PERMISSIONS);
      await handle.close();
      try {
        return await operation();
      } finally {
        await unlink(mutex).catch(() => undefined);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const metadata = await stat(mutex).catch(() => null);
      if (metadata && Date.now() - metadata.mtimeMs > LEASE_MUTEX_STALE_MS) {
        await unlink(mutex).catch(() => undefined);
        continue;
      }
      await sleep(5);
    }
  }

  throw new Error("refresh lease mutex timeout");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read the current lease, ignoring expired entries. */
export async function readRefreshLease(): Promise<RefreshLease | null> {
  const file = leasePath();
  if (!(await fileExists(file))) return null;
  const lease = await readLeaseFile(file);
  if (!lease) return null;
  if (isExpired(lease, Date.now())) return null;
  return lease;
}

/**
 * Try to acquire the refresh lease. Returns `acquired: false` when another
 * live owner holds it; expired leases are replaced.
 */
export async function acquireRefreshLease(options: {
  ownerId: string;
  ttlMs: number;
}): Promise<AcquireResult> {
  return withLeaseMutex(async () => {
    const file = leasePath();
    const now = Date.now();
    const current = await readLeaseFile(file).catch(() => null);
    if (current && !isExpired(current, now)) {
      return { acquired: false, lease: current };
    }
    if (current && isExpired(current, now)) {
      await unlink(file).catch(() => undefined);
    }

    const lease: RefreshLease = {
      ownerId: options.ownerId,
      refreshId: randomBytes(16).toString("hex"),
      expiresAt: now + options.ttlMs,
    };

    await createLeaseFile(file, lease);
    return { acquired: true, lease };
  });
}

/** Release a lease when the supplied refreshId matches the current lease. */
export async function releaseRefreshLease(refreshId: string): Promise<void> {
  await withLeaseMutex(async () => {
    const file = leasePath();
    const current = await readLeaseFile(file);
    if (!current || current.refreshId !== refreshId) return;
    await unlink(file).catch(() => undefined);
  });
}
