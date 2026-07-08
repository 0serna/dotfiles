import { describe, expect, it } from "vitest";
import { formatOpenCodeBalances } from "../status.js";
import type { OpenCodeGoData } from "../types.js";
import { makeContext, stripStyles } from "./helpers.js";

describe("formatOpenCodeBalances", () => {
  const ctx = makeContext();

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
    expect(formatOpenCodeBalances({}, ctx)).toBeNull();
  });

  it("formats R window without label when only rolling is available", () => {
    const result = stripStyles(
      formatOpenCodeBalances(
        { rolling: { remainingPercent: 80, resetInSec: 60 } },
        ctx,
      ),
    );
    expect(result).toContain("80%");
    expect(result).not.toContain("R(");
  });

  it("shows only one window (rolling by default)", () => {
    const result = stripStyles(formatOpenCodeBalances(build(), ctx));
    expect(result).toContain("80%");
    expect(result).not.toContain("W(");
    expect(result).not.toContain("M(");
  });

  it("shows W reset when exhausted (priority over rolling)", () => {
    const result = stripStyles(
      formatOpenCodeBalances(
        build({ weekly: { remainingPercent: 0, resetInSec: 120 } }),
        ctx,
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
        ctx,
      ),
    );
    expect(result).not.toContain("80%");
    expect(result).not.toContain("0%");
    expect(result).toContain("$12.34");
  });

  it("falls back to first available window when rolling is missing", () => {
    const result = stripStyles(
      formatOpenCodeBalances(
        {
          weekly: { remainingPercent: 70, resetInSec: 120 },
          monthly: { remainingPercent: 60, resetInSec: 180 },
        },
        ctx,
      ),
    );
    expect(result).toContain("70%");
  });

  it("omits balance when no window is exhausted", () => {
    const result = stripStyles(formatOpenCodeBalances(build(), ctx));
    expect(result).not.toContain("$");
  });

  it("shows warning reset and balance without 0% when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({ rolling: { remainingPercent: 0, resetInSec: 60 } }),
      ctx,
    );
    expect(stripStyles(result)).not.toContain("0%");
    expect(result).toContain("<warning>$12.34</warning>");
    expect(result).toMatch(/<warning>[^<]+<\/warning>/);
  });

  it("shows known zero balance when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({
        rolling: { remainingPercent: 0, resetInSec: 60 },
        balanceDollars: 0,
      }),
      ctx,
    );
    expect(result).toContain("<warning>$0.00</warning>");
  });

  it("shows unknown balance marker when a window is exhausted", () => {
    const result = formatOpenCodeBalances(
      build({
        rolling: { remainingPercent: 0, resetInSec: 60 },
        balanceDollars: undefined,
      }),
      ctx,
    );
    expect(result).toContain("<warning>?</warning>");
  });

  it("returns null when only balance is available with no windows", () => {
    expect(formatOpenCodeBalances({ balanceDollars: 5.0 }, ctx)).toBeNull();
  });
});
