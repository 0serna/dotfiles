import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetSnapshotStore, withSnapshotLock } from "../snapshot-store.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "quota-lock-"));
  resetSnapshotStore({ stateDir: root, lockDir: join(root, "locks") });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("withSnapshotLock", () => {
  it("serializes concurrent operations on the same state", async () => {
    const order: string[] = [];
    const a = withSnapshotLock(async () => {
      order.push("a:start");
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      order.push("a:end");
    });
    const b = withSnapshotLock(async () => {
      order.push("b:start");
      order.push("b:end");
    });
    await Promise.all([a, b]);
    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("releases the lock when the operation throws", async () => {
    await expect(
      withSnapshotLock(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // The lock should be released; a follow-up operation must succeed.
    await expect(withSnapshotLock(async () => "ok")).resolves.toBe("ok");
  });

  it("times out when the lock cannot be acquired", async () => {
    let release: (() => void) | undefined;
    const blocker = withSnapshotLock(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    // Give the blocker time to acquire the lock.
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    await expect(
      withSnapshotLock(async () => "value", { timeoutMs: 25 }),
    ).rejects.toThrow(/timeout/i);
    release?.();
    await blocker;
  });

  it("takes over a stale lock left by a crashed process", async () => {
    const lockDir = join(root, "locks");
    mkdirSync(lockDir, { recursive: true });
    const lockFile = join(lockDir, "snapshot.mutex");
    // Simulate a lock file from a crashed process.
    await writeFile(lockFile, "orphaned", { flag: "wx" });
    // Set mtime to 10 seconds ago (exceeds SNAPSHOT_MUTEX_STALE_MS).
    const staleTime = new Date(Date.now() - 10_000);
    utimesSync(lockFile, staleTime, staleTime);

    const result = await withSnapshotLock(async () => "recovered");
    expect(result).toBe("recovered");
  });
});
