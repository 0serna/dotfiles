import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clampPercent,
  formatPercentResetSegment,
  formatRelativeExpiry,
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

  it("always dims percent segment regardless of value", () => {
    expect(formatPercentResetSegment("W", 19, "12:00", ctx)).toBe(
      "<dim>W 19% 12:00</dim>",
    );
  });

  it("dims exhausted quota", () => {
    expect(formatPercentResetSegment("R", 0, "12:00", ctx)).toBe(
      "<dim>R 0% 12:00</dim>",
    );
  });
});

describe("formatRelativeExpiry", () => {
  const NOW_SECONDS = 1_700_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SECONDS * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    expect(formatRelativeExpiry(NOW_SECONDS - 1)).toBe("expired");
    expect(formatRelativeExpiry(NOW_SECONDS - 86_400)).toBe("expired");
  });

  it("returns 'expired' when expiresAt equals now", () => {
    expect(formatRelativeExpiry(NOW_SECONDS)).toBe("expired");
  });

  it("rounds up to 'in 1h' for any remaining time under one hour", () => {
    expect(formatRelativeExpiry(NOW_SECONDS + 1)).toBe("in 1h");
    expect(formatRelativeExpiry(NOW_SECONDS + 30 * 60)).toBe("in 1h");
    expect(formatRelativeExpiry(NOW_SECONDS + 59 * 60 + 59)).toBe("in 1h");
  });

  it("formats remaining time under 12h in hours rounded to nearest", () => {
    expect(formatRelativeExpiry(NOW_SECONDS + 60 * 60)).toBe("in 1h");
    expect(formatRelativeExpiry(NOW_SECONDS + 6 * 60 * 60)).toBe("in 6h");
    expect(formatRelativeExpiry(NOW_SECONDS + 11 * 60 * 60 + 30 * 60)).toBe(
      "in 12h",
    );
  });

  it("formats remaining time at or above 12h in days rounded to nearest", () => {
    expect(formatRelativeExpiry(NOW_SECONDS + 12 * 60 * 60)).toBe("in 1d");
    expect(formatRelativeExpiry(NOW_SECONDS + 23 * 60 * 60)).toBe("in 1d");
    expect(formatRelativeExpiry(NOW_SECONDS + 24 * 60 * 60)).toBe("in 1d");
    expect(formatRelativeExpiry(NOW_SECONDS + 23 * 60 * 60 + 59 * 60)).toBe(
      "in 1d",
    );
    expect(formatRelativeExpiry(NOW_SECONDS + 36 * 60 * 60)).toBe("in 2d");
    expect(formatRelativeExpiry(NOW_SECONDS + 30 * 24 * 60 * 60)).toBe(
      "in 30d",
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
