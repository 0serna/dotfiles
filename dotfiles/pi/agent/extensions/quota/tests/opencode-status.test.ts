import { describe, expect, it } from "vitest";
import { formatOpenCodeBalances } from "../status.js";
import type { OpenCodeGoData } from "../types.js";
import { stripStyles } from "./helpers.js";

describe("formatOpenCodeBalances", () => {
  function build(overrides: Partial<OpenCodeGoData> = {}): OpenCodeGoData {
    return {
      rolling: { remainingPercent: 80, resetInSec: 60 },
      weekly: { remainingPercent: 70, resetInSec: 120 },
      monthly: { remainingPercent: 60, resetInSec: 180 },
      balanceDollars: 12.34,
      ...overrides,
    };
  }

  it("returns null when no windows or balance are available", () => {
    expect(formatOpenCodeBalances({})).toBeNull();
  });

  it("formats R window without label when only rolling is available", () => {
    const result = stripStyles(
      formatOpenCodeBalances({
        rolling: { remainingPercent: 80, resetInSec: 60 },
      }),
    );
    expect(result).toContain("80%");
    expect(result).not.toContain("R(");
  });

  it("shows only one window (rolling by default)", () => {
    const result = stripStyles(formatOpenCodeBalances(build()));
    expect(result).toContain("80%");
    expect(result).not.toContain("W(");
    expect(result).not.toContain("M(");
  });

  it("shows W reset when exhausted (priority over rolling)", () => {
    const result = stripStyles(
      formatOpenCodeBalances(
        build({ weekly: { remainingPercent: 0, resetInSec: 120 } }),
      ),
    );
    expect(result).not.toContain("80%");
    expect(result).not.toContain("0%");
    expect(result).toContain("$12.34");
  });

  it("shows M reset when exhausted (highest priority)", () => {
    const result = stripStyles(
      formatOpenCodeBalances(
        build({ monthly: { remainingPercent: 0, resetInSec: 180 } }),
      ),
    );
    expect(result).not.toContain("80%");
    expect(result).not.toContain("0%");
    expect(result).toContain("$12.34");
  });

  it("falls back to first available window when rolling is missing", () => {
    const result = stripStyles(
      formatOpenCodeBalances({
        weekly: { remainingPercent: 70, resetInSec: 120 },
        monthly: { remainingPercent: 60, resetInSec: 180 },
      }),
    );
    expect(result).toContain("70%");
  });

  it("omits balance when no window is exhausted", () => {
    const result = stripStyles(formatOpenCodeBalances(build()));
    expect(result).not.toContain("$");
  });

  it("shows reset and balance without 0% when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({ rolling: { remainingPercent: 0, resetInSec: 60 } }),
    );
    expect(stripStyles(result)).not.toContain("0%");
    expect(result).toContain("$12.34");
  });

  it("shows known zero balance when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({
        rolling: { remainingPercent: 0, resetInSec: 60 },
        balanceDollars: 0,
      }),
    );
    expect(result).toContain("$0.00");
  });

  it("shows unknown balance marker when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({
        rolling: { remainingPercent: 0, resetInSec: 60 },
        balanceDollars: undefined,
      }),
    );
    expect(result).toContain("?");
  });

  it("returns null when only balance is available with no windows", () => {
    expect(formatOpenCodeBalances({ balanceDollars: 5.0 })).toBeNull();
  });
});
