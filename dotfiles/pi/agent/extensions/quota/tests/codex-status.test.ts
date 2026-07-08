import { describe, expect, it } from "vitest";
import { formatCodexQuotaStatus } from "../status.js";
import type { BankedResetDetail, CodexQuotaData } from "../types.js";
import { makeContext, stripStyles } from "./helpers.js";

describe("formatCodexQuotaStatus", () => {
  const ctx = makeContext();

  function build(overrides: Partial<CodexQuotaData> = {}): CodexQuotaData {
    return {
      remaining5h: 80,
      remaining7d: 90,
      remainingCredits: 100,
      bankedResetDetails: undefined,
      resetAt5h: 9999999999,
      resetAt7d: 9999999999,
      ...overrides,
    };
  }

  function resets(count: number): BankedResetDetail[] {
    return Array.from({ length: count }, (_, i) => ({
      expiresAt: 9999999999 + i,
      grantedAt: 0,
      status: "available",
    }));
  }

  it("returns null when no quota windows are available", () => {
    expect(
      formatCodexQuotaStatus(
        build({ remaining5h: undefined, remaining7d: undefined }),
        ctx,
      ),
    ).toBeNull();
  });

  it("formats R window without label", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).toContain("80%");
    expect(result).not.toContain("R(");
  });

  it("shows only one window (rolling by default)", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).not.toContain("W(");
  });

  it("shows W reset when exhausted (priority over rolling)", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ remaining7d: 0 }), ctx),
    );
    expect(result).not.toContain("80%");
    expect(result).not.toContain("0%");
    expect(result).toContain("C100");
  });

  it("falls back to W when R is unavailable", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ remaining5h: undefined, resetAt5h: undefined }),
        ctx,
      ),
    );
    expect(result).toContain("90%");
  });

  it("omits credits when no window is exhausted", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).not.toContain("C");
  });

  it("shows warning reset and C<n> without 0% when a window is exhausted", () => {
    const result = formatCodexQuotaStatus(build({ remaining5h: 0 }), ctx);
    expect(stripStyles(result)).not.toContain("0%");
    expect(result).toContain("<warning>C100</warning>");
    expect(result).toMatch(/<warning>[^<]+<\/warning>/);
  });

  it("shows unknown credits marker when exhausted credits are unavailable", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, remainingCredits: undefined }),
      ctx,
    );
    expect(result).toContain("<warning>?</warning>");
  });

  it("shows known zero credits when a window is exhausted", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, remainingCredits: 0 }),
      ctx,
    );
    expect(result).toContain("<warning>C0</warning>");
  });

  it("omits R<n> when all windows are healthy", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ bankedResetDetails: resets(3) }), ctx),
    );
    expect(result).not.toContain("R3");
  });

  it("includes R<n> after credits when window is exhausted and resets are available", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, bankedResetDetails: resets(3) }),
      ctx,
    );
    expect(result).toContain("<accent>R3</accent>");
    const plain = stripStyles(result)!;
    expect(plain).toContain("R3");
    expect(plain.indexOf("C100")).toBeLessThan(plain.indexOf("R3"));
  });

  it("omits R<n> when below threshold but not exhausted", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ remaining5h: 15, bankedResetDetails: resets(3) }),
        ctx,
      ),
    );
    expect(result).not.toContain("R3");
  });

  it("shows R0 as dim when bankedResetDetails is empty and window is exhausted", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, bankedResetDetails: [] }),
      ctx,
    );
    expect(result).toContain("<dim>R0</dim>");
    expect(stripStyles(result)).toContain("R0");
  });

  it("omits R segment when bankedResetDetails is undefined", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ bankedResetDetails: undefined, remaining5h: 0 }),
        ctx,
      ),
    );
    expect(result).not.toMatch(/\bR\d/);
  });

  it("omits R0 when window is not exhausted and no credits", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({
          remaining5h: 15,
          bankedResetDetails: [],
          remainingCredits: undefined,
        }),
        ctx,
      ),
    );
    expect(result).not.toContain("R0");
    expect(result).not.toContain("C");
  });
});
