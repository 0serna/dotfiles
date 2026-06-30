import { describe, expect, it } from "vitest";
import { formatCodexQuotaStatus } from "../status.js";
import type { CodexQuotaData } from "../types.js";
import { makeContext, stripStyles } from "./helpers.js";

describe("formatCodexQuotaStatus", () => {
  const ctx = makeContext();

  function build(overrides: Partial<CodexQuotaData> = {}): CodexQuotaData {
    return {
      remaining5h: 80,
      remaining7d: 90,
      remainingCredits: 100,
      bankedResetCredits: undefined,
      resetAt5h: 9999999999,
      resetAt7d: 9999999999,
      ...overrides,
    };
  }

  it("returns null when no quota windows are available", () => {
    expect(
      formatCodexQuotaStatus(
        build({ remaining5h: undefined, remaining7d: undefined }),
        ctx,
      ),
    ).toBeNull();
  });

  it("formats R window with label", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).toContain("R(80%");
  });

  it("omits healthy 7d window (W) from compact status", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).not.toContain("W(");
  });

  it("shows W window when below threshold", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ remaining7d: 15 }), ctx),
    );
    expect(result).toContain("R(80%");
    expect(result).toContain("W(15%");
  });

  it("falls back to W when R is unavailable", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ remaining5h: undefined, resetAt5h: undefined }),
        ctx,
      ),
    );
    expect(result).toContain("W(90%");
    expect(result).not.toContain("R(");
  });

  it("omits credits when no window is exhausted", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).not.toContain("C");
  });

  it("shows C<n> when a window is exhausted and credits available", () => {
    const result = formatCodexQuotaStatus(build({ remaining5h: 0 }), ctx);
    expect(result).toContain("<warning>C100</warning>");
  });

  it("omits credits segment when credits are unavailable", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ remainingCredits: undefined }), ctx),
    );
    expect(result).not.toContain("C");
  });

  it("omits R<n> when all windows are healthy", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ bankedResetCredits: 3 }), ctx),
    );
    expect(result).not.toContain("R3");
  });

  it("includes R<n> when below threshold and before C<n>", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining7d: 15, bankedResetCredits: 3 }),
      ctx,
    );
    const plainResult = stripStyles(result);
    expect(result).toContain("<accent>R3</accent>");

    const rIndex = plainResult!.indexOf("R3");
    const cIndex = plainResult!.indexOf("C100");
    expect(rIndex).toBeGreaterThanOrEqual(0);
    if (cIndex >= 0) expect(rIndex).toBeLessThan(cIndex);
  });

  it("shows R0 as dim when bankedResetCredits is explicitly 0 and below threshold", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining7d: 15, bankedResetCredits: 0 }),
      ctx,
    );
    expect(result).toContain("<dim>R0</dim>");
    expect(stripStyles(result)).toContain("R0");
  });

  it("omits banked reset segment when bankedResetCredits is undefined", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ bankedResetCredits: undefined }), ctx),
    );
    expect(result).not.toMatch(/\bR\d/);
  });

  it("handles bankedResetCredits=0 with no credits gracefully", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({
          remaining7d: 15,
          bankedResetCredits: 0,
          remainingCredits: undefined,
        }),
        ctx,
      ),
    );
    expect(result).toContain("R0");
    expect(result).not.toContain("C");
  });
});
