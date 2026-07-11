import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThroughputTracker } from "../throughput.ts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ThroughputTracker initial state", () => {
  it("returns null in idle", () => {
    const tracker = new ThroughputTracker();
    expect(tracker.getDisplay()).toBeNull();
    expect(tracker.getFinalThroughput()).toBeNull();
  });

  it("ignores addDelta when idle", () => {
    const tracker = new ThroughputTracker();
    tracker.addDelta("hello world");
    expect(tracker.getDisplay()).toBeNull();
  });

  it("ignores endStream when idle", () => {
    const tracker = new ThroughputTracker();
    tracker.endStream(100);
    expect(tracker.getDisplay()).toBeNull();
  });
});

describe("ThroughputTracker streaming", () => {
  it("returns null before any time has elapsed", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("hello world");

    // elapsedMs is 0, so no throughput yet
    expect(tracker.getDisplay()).toBeNull();
  });

  it("publishes live throughput on the next tick", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400)); // 100 estimated tokens

    vi.advanceTimersByTime(1000);

    // 100 tokens / 1s = 100 tok/s
    expect(tracker.getDisplay()).toBe("100 tok/s");
  });

  it("updates live throughput as time advances", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));

    vi.advanceTimersByTime(1000);
    expect(tracker.getDisplay()).toBe("100 tok/s");

    vi.advanceTimersByTime(1000);
    // Same 100 tokens over 2 seconds = 50 tok/s
    expect(tracker.getDisplay()).toBe("50 tok/s");
  });

  it("accumulates tokens from multiple deltas", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(200)); // 50 tokens
    tracker.addDelta("x".repeat(200)); // +50 tokens

    vi.advanceTimersByTime(1000);

    // 100 tokens / 1s = 100 tok/s
    expect(tracker.getDisplay()).toBe("100 tok/s");
  });

  it("ignores deltas with zero length", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("");

    vi.advanceTimersByTime(1000);

    expect(tracker.getDisplay()).toBeNull();
  });
});

describe("ThroughputTracker final phase", () => {
  it("stores the final throughput and returns null from getDisplay", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));

    vi.advanceTimersByTime(1000);
    tracker.endStream(200); // provider reports 200 output tokens

    expect(tracker.getDisplay()).toBeNull(); // placeholder during tool exec
    expect(tracker.getFinalThroughput()).toBe("200 tok/s");
  });

  it("preserves last final when endStream is called without usage", () => {
    const tracker = new ThroughputTracker();

    // First stream ends with a final value
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(100);
    expect(tracker.getFinalThroughput()).toBe("100 tok/s");

    // Second stream ends without usage → preserves previous
    tracker.startStream();
    tracker.addDelta("y".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream();
    expect(tracker.getFinalThroughput()).toBe("100 tok/s");
  });

  it("preserves last final when endStream is called with zero usage", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(150);
    expect(tracker.getFinalThroughput()).toBe("150 tok/s");

    tracker.startStream();
    vi.advanceTimersByTime(2000);
    tracker.endStream(0);
    expect(tracker.getFinalThroughput()).toBe("150 tok/s");
  });

  it("returns null from getDisplay during tool execution", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(100);

    // Simulate long tool execution
    vi.advanceTimersByTime(10_000);

    expect(tracker.getDisplay()).toBeNull();
  });
});

describe("ThroughputTracker stream transitions", () => {
  it("transitions from final back to streaming on a new stream", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(100);

    // During tool execution: placeholder
    expect(tracker.getDisplay()).toBeNull();

    // New stream begins (no deltas yet)
    tracker.startStream();
    expect(tracker.getDisplay()).toBeNull();

    tracker.addDelta("y".repeat(800));
    vi.advanceTimersByTime(1000);
    // 200 tokens / 1s = 200 tok/s — independent of previous stream
    expect(tracker.getDisplay()).toBe("200 tok/s");
  });

  it("does not include prior stream tokens in the new stream", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(4000)); // 1000 tokens
    vi.advanceTimersByTime(2000);
    tracker.endStream(1000);

    // New stream with a single small delta
    tracker.startStream();
    tracker.addDelta("hi"); // ceil(2/4) = 1 token
    vi.advanceTimersByTime(1000);
    expect(tracker.getDisplay()).toBe("1 tok/s");
  });

  it("excludes agent latency from throughput", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    vi.advanceTimersByTime(5000);
    tracker.addDelta("x".repeat(400));

    vi.advanceTimersByTime(1000);
    expect(tracker.getDisplay()).toBe("100 tok/s");
  });
});

describe("ThroughputTracker reset", () => {
  it("clears all state on reset", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(100);

    tracker.reset();
    expect(tracker.getDisplay()).toBeNull();
    expect(tracker.getFinalThroughput()).toBeNull();
  });

  it("allows a fresh measurement after reset", () => {
    const tracker = new ThroughputTracker();
    tracker.startStream();
    tracker.addDelta("x".repeat(400));
    vi.advanceTimersByTime(1000);
    tracker.endStream(100);
    tracker.reset();

    tracker.startStream();
    tracker.addDelta("y".repeat(800));
    vi.advanceTimersByTime(1000);
    expect(tracker.getDisplay()).toBe("200 tok/s");
    expect(tracker.getFinalThroughput()).toBeNull();
  });
});
