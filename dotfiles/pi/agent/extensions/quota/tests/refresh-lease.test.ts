import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireRefreshLease,
  readRefreshLease,
  releaseRefreshLease,
  setLeaseDirectory,
  type RefreshLease,
} from "../refresh-lease.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "quota-lease-"));
  setLeaseDirectory(join(root, "lease"));
});

afterEach(() => {
  setLeaseDirectory(undefined);
  rmSync(root, { recursive: true, force: true });
});

describe("acquireRefreshLease", () => {
  it("grants the lease to the first caller and rejects the second", async () => {
    const first = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 5_000,
    });
    expect(first.acquired).toBe(true);
    if (!first.acquired) return;
    expect(first.lease.ownerId).toBe("owner-1");
    expect(first.lease.refreshId).toBeTruthy();

    const second = await acquireRefreshLease({
      ownerId: "owner-2",
      ttlMs: 5_000,
    });
    expect(second.acquired).toBe(false);
  });

  it("elects exactly one owner when callers race", async () => {
    const results = await Promise.all([
      acquireRefreshLease({ ownerId: "owner-1", ttlMs: 5_000 }),
      acquireRefreshLease({ ownerId: "owner-2", ttlMs: 5_000 }),
    ]);

    expect(results.filter((result) => result.acquired)).toHaveLength(1);
  });

  it("releases the lease and lets a new owner acquire it", async () => {
    const first = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 5_000,
    });
    if (!first.acquired) throw new Error("expected first to acquire");
    await releaseRefreshLease(first.lease.refreshId);

    const second = await acquireRefreshLease({
      ownerId: "owner-2",
      ttlMs: 5_000,
    });
    expect(second.acquired).toBe(true);
  });

  it("lets a new owner take over after the lease expires", async () => {
    const first = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 1,
    });
    if (!first.acquired) throw new Error("expected first to acquire");

    // Wait for the lease to expire.
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });

    const second = await acquireRefreshLease({
      ownerId: "owner-2",
      ttlMs: 5_000,
    });
    expect(second.acquired).toBe(true);
  });

  it("elects one takeover owner when an expired lease is contested", async () => {
    const expired = await acquireRefreshLease({
      ownerId: "expired-owner",
      ttlMs: 1,
    });
    if (!expired.acquired) throw new Error("expected initial lease");
    await new Promise((resolve) => setTimeout(resolve, 5));

    const results = await Promise.all([
      acquireRefreshLease({ ownerId: "owner-1", ttlMs: 5_000 }),
      acquireRefreshLease({ ownerId: "owner-2", ttlMs: 5_000 }),
    ]);

    expect(results.filter((result) => result.acquired)).toHaveLength(1);
  });

  it("round-trips a lease via readRefreshLease", async () => {
    const first = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 5_000,
    });
    if (!first.acquired) throw new Error("expected first to acquire");
    const read = await readRefreshLease();
    expect(read?.ownerId).toBe("owner-1");
  });

  it("rejects release from a different refresh id", async () => {
    const first = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 5_000,
    });
    if (!first.acquired) throw new Error("expected first to acquire");
    await releaseRefreshLease("different-refresh-id");
    const read = await readRefreshLease();
    expect(read?.ownerId).toBe("owner-1");
  });
});

describe("RefreshLease invariants", () => {
  it("includes a non-empty refreshId and absolute expiresAt", async () => {
    const before = Date.now();
    const result = await acquireRefreshLease({
      ownerId: "owner-1",
      ttlMs: 1000,
    });
    if (!result.acquired) throw new Error("expected lease");
    const lease: RefreshLease = result.lease;
    expect(lease.refreshId.length).toBeGreaterThan(0);
    expect(lease.expiresAt).toBeGreaterThanOrEqual(before + 1000);
  });
});
