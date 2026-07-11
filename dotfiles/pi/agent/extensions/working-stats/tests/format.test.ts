import { describe, expect, it } from "vitest";
import { formatDuration } from "../format.ts";

describe("formatDuration", () => {
  it("formats zero as 0s", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats sub-second as 0s", () => {
    expect(formatDuration(499)).toBe("0s");
  });

  it("formats seconds", () => {
    expect(formatDuration(42_000)).toBe("42s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(83_000)).toBe("1m 23s");
  });

  it("rounds to nearest second", () => {
    expect(formatDuration(1500)).toBe("2s");
    expect(formatDuration(1499)).toBe("1s");
  });

  it("handles negative values as 0s", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });
});
