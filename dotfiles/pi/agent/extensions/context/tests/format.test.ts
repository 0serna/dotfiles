import { describe, expect, it } from "vitest";
import {
  formatCacheHit,
  formatCurrentUsage,
  formatK,
  formatPercent,
  isCacheBelowThreshold,
  type CacheUsageEntry,
} from "../format.ts";

function assistantUsageEntry(
  input: number,
  cacheRead: number,
): CacheUsageEntry {
  return {
    type: "message",
    message: {
      role: "assistant",
      usage: { input, cacheRead },
    },
  };
}

describe("formatK", () => {
  it("returns zero in integer k-format", () => {
    expect(formatK(0)).toBe("0k");
  });

  it("rounds values below 1000 to integer k-format", () => {
    expect(formatK(900)).toBe("1k");
  });

  it("rounds values above 999 to integer k-format", () => {
    expect(formatK(1234)).toBe("1k");
  });

  it("rounds decimal thousands to integer k-format", () => {
    expect(formatK(41_900)).toBe("42k");
  });
});

describe("formatPercent", () => {
  it("rounds to nearest integer percent", () => {
    expect(formatPercent(66.666)).toBe("67%");
  });

  it("supports zero percent", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatCurrentUsage", () => {
  it("returns zero tokens when usage is undefined", () => {
    expect(formatCurrentUsage(undefined)).toBe("0k");
  });

  it("returns zero tokens when tokens are null", () => {
    expect(
      formatCurrentUsage({
        tokens: null,
        contextWindow: 200_000,
        percent: null,
      }),
    ).toBe("0k");
  });

  it("formats provided token value", () => {
    expect(
      formatCurrentUsage({
        tokens: 12_345,
        contextWindow: 200_000,
        percent: 6.2,
      }),
    ).toBe("12k");
  });
});

describe("formatCacheHit", () => {
  it("returns unavailable reason when no entries exist", () => {
    expect(formatCacheHit([])).toEqual({
      text: "◉ 0%",
      percent: 0,
      input: 0,
      cacheRead: 0,
      belowThresholdStreak: 0,
      cacheUnavailableReason: "no_assistant_messages",
    });
  });

  it("returns unavailable reason when no entries have assistant usage", () => {
    const entries: CacheUsageEntry[] = [
      { type: "message", message: { role: "user" } },
    ];

    expect(formatCacheHit(entries)).toEqual({
      text: "◉ 0%",
      percent: 0,
      input: 0,
      cacheRead: 0,
      belowThresholdStreak: 0,
      cacheUnavailableReason: "no_assistant_messages",
    });
  });

  it("returns unavailable reason when all cache reads are zero", () => {
    const entries: CacheUsageEntry[] = [
      assistantUsageEntry(100, 0),
      assistantUsageEntry(200, 0),
    ];

    expect(formatCacheHit(entries)).toEqual({
      text: "◉ 0%",
      percent: 0,
      input: 200,
      cacheRead: 0,
      belowThresholdStreak: 2,
      cacheUnavailableReason: "no_cache_reads",
    });
  });

  it("returns unavailable reason when denominator is zero", () => {
    const entries: CacheUsageEntry[] = [
      assistantUsageEntry(0, 1),
      assistantUsageEntry(0, 0),
    ];

    expect(formatCacheHit(entries)).toEqual({
      text: "◉ 0%",
      percent: 0,
      input: 0,
      cacheRead: 0,
      belowThresholdStreak: 1,
      cacheUnavailableReason: "zero_denominator",
    });
  });

  it("computes cache hit rate from the latest assistant message", () => {
    const entries: CacheUsageEntry[] = [
      assistantUsageEntry(100, 900),
      assistantUsageEntry(200, 300),
    ];

    expect(formatCacheHit(entries)).toEqual({
      text: "◉ 60%",
      percent: 60,
      input: 200,
      cacheRead: 300,
      belowThresholdStreak: 1,
    });
  });

  it("counts consecutive latest cache hits below threshold", () => {
    const entries: CacheUsageEntry[] = [
      assistantUsageEntry(100, 900),
      assistantUsageEntry(800, 200),
      assistantUsageEntry(900, 100),
    ];

    expect(formatCacheHit(entries)).toMatchObject({
      text: "◉ 10%",
      percent: 10,
      belowThresholdStreak: 2,
    });
  });
});

describe("isCacheBelowThreshold", () => {
  it("returns false when only the latest percent is below threshold", () => {
    expect(
      isCacheBelowThreshold({
        text: "◉ 0%",
        percent: 0,
        input: 0,
        cacheRead: 0,
        belowThresholdStreak: 1,
        cacheUnavailableReason: "no_assistant_messages",
      }),
    ).toBe(false);
  });

  it("returns false when percent meets threshold", () => {
    expect(
      isCacheBelowThreshold({
        text: "◉ 80%",
        percent: 80,
        input: 100,
        cacheRead: 400,
        belowThresholdStreak: 0,
      }),
    ).toBe(false);
  });

  it("returns false when only three latest percents are below threshold", () => {
    expect(
      isCacheBelowThreshold({
        text: "◉ 79%",
        percent: 79,
        input: 210,
        cacheRead: 790,
        belowThresholdStreak: 3,
      }),
    ).toBe(false);
  });

  it("returns true when more than three latest percents are below threshold", () => {
    expect(
      isCacheBelowThreshold({
        text: "◉ 79%",
        percent: 79,
        input: 210,
        cacheRead: 790,
        belowThresholdStreak: 4,
      }),
    ).toBe(true);
  });
});
