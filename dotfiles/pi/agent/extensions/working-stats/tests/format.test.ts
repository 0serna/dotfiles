import { describe, expect, it } from "vitest";
import { formatCompactDuration, formatDuration } from "../format.ts";

describe("formatDuration", () => {
  it("formats zero as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats sub-second as 0:00", () => {
    expect(formatDuration(499)).toBe("0:00");
  });

  it("formats seconds as M:SS with zero-padded seconds", () => {
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(42_000)).toBe("0:42");
  });

  it("formats minutes and seconds as M:SS", () => {
    expect(formatDuration(83_000)).toBe("1:23");
  });

  it("rounds to nearest second", () => {
    expect(formatDuration(1500)).toBe("0:02");
    expect(formatDuration(1499)).toBe("0:01");
  });

  it("handles negative values as 0:00", () => {
    expect(formatDuration(-1000)).toBe("0:00");
  });

  it("formats hours as H:MM:SS", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
});

describe("formatCompactDuration", () => {
  it("formats zero as 0s", () => {
    expect(formatCompactDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatCompactDuration(3000)).toBe("3s");
    expect(formatCompactDuration(42000)).toBe("42s");
  });

  it("formats minutes without seconds", () => {
    expect(formatCompactDuration(120_000)).toBe("2m");
  });

  it("formats minutes with seconds", () => {
    expect(formatCompactDuration(83_000)).toBe("1m23s");
  });

  it("formats hours", () => {
    expect(formatCompactDuration(3_600_000)).toBe("1h0m");
    expect(formatCompactDuration(3_725_000)).toBe("1h2m");
  });

  it("handles negative values as 0s", () => {
    expect(formatCompactDuration(-1000)).toBe("0s");
  });

  it("rounds to nearest second", () => {
    expect(formatCompactDuration(1500)).toBe("2s");
    expect(formatCompactDuration(1499)).toBe("1s");
  });
});
