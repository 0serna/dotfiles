import { describe, expect, it } from "vitest";
import {
  formatDuration,
  inferLastDuration,
  type SessionEntry,
} from "../helpers.ts";

describe("formatDuration", () => {
  it("formats zero as 0s", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats sub-second as 0s", () => {
    expect(formatDuration(499)).toBe("0s");
  });

  it("formats 1 second", () => {
    expect(formatDuration(1000)).toBe("1s");
  });

  it("formats 42 seconds", () => {
    expect(formatDuration(42_000)).toBe("42s");
  });

  it("formats 59 seconds", () => {
    expect(formatDuration(59_000)).toBe("59s");
  });

  it("formats 60 seconds as 1m 0s", () => {
    expect(formatDuration(60_000)).toBe("1m 0s");
  });

  it("formats 1 minute 23 seconds", () => {
    expect(formatDuration(83_000)).toBe("1m 23s");
  });

  it("formats 2 minutes 5 seconds", () => {
    expect(formatDuration(125_000)).toBe("2m 5s");
  });

  it("rounds to nearest second", () => {
    expect(formatDuration(1500)).toBe("2s");
    expect(formatDuration(1499)).toBe("1s");
  });

  it("handles negative values as 0s", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });
});

function makeEntry(
  type: string,
  timestamp: string,
  role?: string,
): SessionEntry {
  return {
    type,
    timestamp,
    ...(role ? { message: { role } } : {}),
  };
}

describe("inferLastDuration", () => {
  it("returns null for empty entries", () => {
    expect(inferLastDuration([])).toBeNull();
  });

  it("returns null when only user messages exist", () => {
    const entries = [
      makeEntry("message", "2024-01-01T00:00:00Z", "user"),
      makeEntry("message", "2024-01-01T00:01:00Z", "user"),
    ];
    expect(inferLastDuration(entries)).toBeNull();
  });

  it("returns null when only assistant messages exist", () => {
    const entries = [makeEntry("message", "2024-01-01T00:00:00Z", "assistant")];
    expect(inferLastDuration(entries)).toBeNull();
  });

  it("infers duration from a completed user-assistant block", () => {
    const entries = [
      makeEntry("message", "2024-01-01T00:00:00Z", "user"),
      makeEntry("message", "2024-01-01T00:00:05Z", "assistant"),
    ];
    expect(inferLastDuration(entries)).toBe(5000);
  });

  it("uses the last generated message in a multi-message block", () => {
    const entries = [
      makeEntry("message", "2024-01-01T00:00:00Z", "user"),
      makeEntry("message", "2024-01-01T00:00:03Z", "assistant"),
      makeEntry("message", "2024-01-01T00:00:08Z", "assistant"),
    ];
    expect(inferLastDuration(entries)).toBe(8000);
  });

  it("ignores non-message entries", () => {
    const entries = [
      makeEntry("compaction", "2024-01-01T00:00:00Z"),
      makeEntry("message", "2024-01-01T00:00:01Z", "user"),
      makeEntry("message", "2024-01-01T00:00:06Z", "assistant"),
    ];
    expect(inferLastDuration(entries)).toBe(5000);
  });

  it("returns the latest block when multiple user blocks exist", () => {
    const entries = [
      makeEntry("message", "2024-01-01T00:00:00Z", "user"),
      makeEntry("message", "2024-01-01T00:00:10Z", "assistant"),
      makeEntry("message", "2024-01-01T00:01:00Z", "user"),
      makeEntry("message", "2024-01-01T00:01:05Z", "assistant"),
    ];
    // Latest block: user at 01:00, assistant at 01:05 → 5s
    expect(inferLastDuration(entries)).toBe(5000);
  });

  it("skips incomplete block (user with no following generated message)", () => {
    const entries = [
      makeEntry("message", "2024-01-01T00:00:00Z", "user"),
      makeEntry("message", "2024-01-01T00:00:10Z", "assistant"),
      makeEntry("message", "2024-01-01T00:01:00Z", "user"),
    ];
    // Last user has no following generated message; fall back to first block.
    expect(inferLastDuration(entries)).toBe(10_000);
  });
});
