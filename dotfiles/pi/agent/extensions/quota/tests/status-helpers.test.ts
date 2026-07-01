import { describe, expect, it } from "vitest";
import {
  clampPercent,
  formatPercentResetSegment,
  formatResetTime,
  parseCredits,
  selectCompactWindows,
  toRemainingPercent,
} from "../status.js";
import { makeContext } from "./helpers.js";

describe("clampPercent", () => {
  it("rounds and clamps percent values", () => {
    expect(clampPercent(42.4)).toBe(42);
    expect(clampPercent(42.5)).toBe(43);
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(110)).toBe(100);
  });
});

describe("toRemainingPercent", () => {
  it("uses remaining_percent before used_percent", () => {
    expect(
      toRemainingPercent({ remaining_percent: 42.6, used_percent: 90 }),
    ).toBe(43);
  });

  it("derives remaining percent from used_percent", () => {
    expect(toRemainingPercent({ used_percent: 33.3 })).toBe(67);
  });

  it("returns undefined when no percent is available", () => {
    expect(toRemainingPercent(undefined)).toBeUndefined();
    expect(toRemainingPercent({})).toBeUndefined();
  });
});

describe("parseCredits", () => {
  it("returns undefined for unlimited accounts", () => {
    expect(parseCredits(100, true)).toBeUndefined();
  });

  it("returns floor of numeric balance", () => {
    expect(parseCredits(42.7, false)).toBe(42);
  });

  it("returns floor of string balance", () => {
    expect(parseCredits("42.7", false)).toBe(42);
  });

  it("returns 0 for negative balance", () => {
    expect(parseCredits(-5, false)).toBe(0);
  });

  it("returns undefined for invalid balance", () => {
    expect(parseCredits(undefined, false)).toBeUndefined();
  });
});

describe("formatResetTime", () => {
  it("formats today's reset time with 24-hour hours", () => {
    const reset = new Date();
    reset.setHours(13, 5, 0, 0);

    expect(formatResetTime(Math.floor(reset.getTime() / 1000))).toBe("13:05");
  });
});

describe("formatPercentResetSegment", () => {
  const ctx = makeContext();

  it("emits label percent% reset format", () => {
    expect(formatPercentResetSegment("R", 82, "14:20", ctx)).toBe(
      "<dim>R 82% 14:20</dim>",
    );
  });

  it("warns when remaining percent is below the threshold", () => {
    expect(formatPercentResetSegment("W", 19, "12:00", ctx)).toBe(
      "<warning>W 19% 12:00</warning>",
    );
  });

  it("dims exhausted quota when warning is suppressed", () => {
    expect(formatPercentResetSegment("R", 0, "12:00", ctx, true)).toBe(
      "<dim>R 0% 12:00</dim>",
    );
  });
});

describe("selectCompactWindows", () => {
  it("returns rolling by default when no windows are exhausted", () => {
    const result = selectCompactWindows([
      { label: "R", percent: 80, resetLabel: "14:00", isPrimary: true },
      { label: "W", percent: 10, resetLabel: "3d", isPrimary: false },
      { label: "M", percent: 50, resetLabel: "7d", isPrimary: false },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.isPrimary).toBe(true);
  });

  it("omits longer windows above threshold", () => {
    const result = selectCompactWindows([
      { label: "R", percent: 80, resetLabel: "14:00", isPrimary: true },
      { label: "W", percent: 50, resetLabel: "3d", isPrimary: false },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.isPrimary).toBe(true);
  });

  it("falls back to first available window when primary is missing", () => {
    const result = selectCompactWindows([
      { label: "W", percent: 50, resetLabel: "3d", isPrimary: false },
      { label: "M", percent: 80, resetLabel: "7d", isPrimary: false },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.percent).toBe(50);
  });

  it("returns empty array when no candidates", () => {
    expect(selectCompactWindows([])).toHaveLength(0);
  });
});
