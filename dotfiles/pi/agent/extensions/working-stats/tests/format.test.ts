import { describe, expect, it } from "vitest";
import { formatDuration } from "../format.ts";

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
