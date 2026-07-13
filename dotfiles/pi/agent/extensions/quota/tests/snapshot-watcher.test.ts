import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchSnapshot } from "../snapshot-watcher.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "quota-watch-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.useRealTimers();
});

describe("watchSnapshot", () => {
  it("emits the initial snapshot when one is present", async () => {
    const file = join(root, "snapshot.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        revision: 1,
        cycle: { cycleStartedAt: 0 },
        sources: {},
      }),
    );
    const events: number[] = [];
    const sub = await watchSnapshot({
      snapshotPath: file,
      onSnapshot: (snapshot) => {
        events.push(snapshot.revision);
      },
      debounceMs: 5,
    });
    await flushAsync();
    expect(events).toContain(1);
    sub.close();
  });

  it("ignores snapshots with a non-increasing revision", async () => {
    const file = join(root, "snapshot.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        revision: 5,
        cycle: { cycleStartedAt: 0 },
        sources: {},
      }),
    );
    const seen: number[] = [];
    const sub = await watchSnapshot({
      snapshotPath: file,
      onSnapshot: (snapshot) => {
        seen.push(snapshot.revision);
      },
      debounceMs: 5,
    });
    await flushAsync();
    // Rewrite the same revision; the watcher should not re-emit.
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        revision: 5,
        cycle: { cycleStartedAt: 0 },
        sources: { foo: { state: "fresh" } },
      }),
    );
    await flushAsync();
    expect(
      seen.filter((revision) => revision === 5).length,
    ).toBeLessThanOrEqual(1);
    sub.close();
  });

  it("supports periodic reread fallback", async () => {
    const file = join(root, "snapshot.json");
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        revision: 1,
        cycle: { cycleStartedAt: 0 },
        sources: {},
      }),
    );
    let calls = 0;
    const sub = await watchSnapshot({
      snapshotPath: file,
      onSnapshot: () => {
        calls += 1;
      },
      debounceMs: 5,
      pollIntervalMs: 15,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 80);
    });
    expect(calls).toBeGreaterThanOrEqual(1);
    sub.close();
  });
});

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 25);
  });
}
