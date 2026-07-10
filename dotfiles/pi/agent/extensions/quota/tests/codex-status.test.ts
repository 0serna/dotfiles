import { describe, expect, it } from "vitest";
import { formatCodexQuotaStatus } from "../status.js";
import type { BankedResetDetail, CodexQuotaData } from "../types.js";
import { stripStyles } from "./helpers.js";

describe("formatCodexQuotaStatus", () => {
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
      ),
    ).toBeNull();
  });

  it("formats R window without label", () => {
    const result = stripStyles(formatCodexQuotaStatus(build()));
    expect(result).toContain("80%");
    expect(result).not.toContain("R(");
  });

  it("shows only one window (rolling by default)", () => {
    const result = stripStyles(formatCodexQuotaStatus(build()));
    expect(result).not.toContain("W(");
  });

  it("shows W reset when exhausted (priority over rolling)", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ remaining7d: 0 })),
    );
    expect(result).not.toContain("80%");
    expect(result).not.toContain("0%");
    expect(result).toContain("C100");
  });

  it("falls back to W when R is unavailable", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ remaining5h: undefined, resetAt5h: undefined }),
      ),
    );
    expect(result).toContain("90%");
  });

  it("omits credits when no window is exhausted", () => {
    const result = stripStyles(formatCodexQuotaStatus(build()));
    expect(result).not.toContain("C");
  });

  it("shows reset and C<n> without 0% when a window is exhausted", () => {
    const result = formatCodexQuotaStatus(build({ remaining5h: 0 }));
    expect(stripStyles(result)).not.toContain("0%");
    expect(result).toContain("C100");
  });

  it("shows unknown credits marker when exhausted credits are unavailable", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, remainingCredits: undefined }),
    );
    expect(result).toContain("?");
  });

  it("shows known zero credits when a window is exhausted", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, remainingCredits: 0 }),
    );
    expect(result).toContain("C0");
  });

  it("omits R<n> when all windows are healthy", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ bankedResetDetails: resets(3) })),
    );
    expect(result).not.toContain("R3");
  });

  it("includes R<n> after credits when window is exhausted and resets are available", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, bankedResetDetails: resets(3) }),
    );
    expect(result).toContain("R3");
    expect(result!.indexOf("C100")).toBeLessThan(result!.indexOf("R3"));
  });

  it("omits R<n> when below threshold but not exhausted", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ remaining5h: 15, bankedResetDetails: resets(3) }),
      ),
    );
    expect(result).not.toContain("R3");
  });

  it("shows R0 when bankedResetDetails is empty and window is exhausted", () => {
    const result = formatCodexQuotaStatus(
      build({ remaining5h: 0, bankedResetDetails: [] }),
    );
    expect(result).toContain("R0");
  });

  it("omits R segment when bankedResetDetails is undefined", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ bankedResetDetails: undefined, remaining5h: 0 }),
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
      ),
    );
    expect(result).not.toContain("R0");
    expect(result).not.toContain("C");
  });
});
