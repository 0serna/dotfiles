import { describe, expect, it } from "vitest";
import {
  formatCodexQuotaStatus,
  formatResetTime,
  parseCredits,
} from "../status.js";
import type { CodexQuotaData, ExtensionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(): ExtensionContext {
  return {
    ui: {
      setStatus: () => {},
      theme: {
        fg: (style: string, text: string) => `<${style}>${text}</${style}>`,
      },
    },
  } as unknown as ExtensionContext;
}

function stripStyles(value: string | null): string | null {
  return value?.replaceAll(/<\/?[^>]+>/g, "") ?? null;
}

// ---------------------------------------------------------------------------
// parseCredits
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// formatResetTime
// ---------------------------------------------------------------------------

describe("formatResetTime", () => {
  it("formats today's reset time with 24-hour hours", () => {
    const reset = new Date();
    reset.setHours(13, 5, 0, 0);

    expect(formatResetTime(Math.floor(reset.getTime() / 1000))).toBe("13:05");
  });
});

// ---------------------------------------------------------------------------
// formatCodexQuotaStatus
// ---------------------------------------------------------------------------

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

  it("returns null when 5h quota is missing", () => {
    expect(
      formatCodexQuotaStatus(build({ remaining5h: undefined }), ctx),
    ).toBeNull();
  });

  it("returns null when 7d quota is missing", () => {
    expect(
      formatCodexQuotaStatus(build({ remaining7d: undefined }), ctx),
    ).toBeNull();
  });

  it("includes all quota windows and credits by default", () => {
    const result = stripStyles(formatCodexQuotaStatus(build(), ctx));
    expect(result).toContain("80");
    expect(result).toContain("90");
    expect(result).toContain("C100");
  });

  it("omits credits segment when credits are unavailable", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ remainingCredits: undefined }), ctx),
    );
    expect(result).not.toContain("C");
  });

  // --- Banked reset credits ---

  it("includes R<n> when bankedResetCredits is available and before C<n>", () => {
    const result = formatCodexQuotaStatus(
      build({ bankedResetCredits: 3 }),
      ctx,
    );
    const plainResult = stripStyles(result);
    expect(result).toContain("<accent>R3</accent>");
    expect(plainResult).toContain("R3");
    // R should appear before C in the string
    const rIndex = plainResult!.indexOf("R3");
    const cIndex = plainResult!.indexOf("C100");
    expect(rIndex).toBeGreaterThanOrEqual(0);
    expect(cIndex).toBeGreaterThanOrEqual(0);
    expect(rIndex).toBeLessThan(cIndex);
  });

  it("shows R0 as dim when bankedResetCredits is explicitly 0", () => {
    const result = formatCodexQuotaStatus(
      build({ bankedResetCredits: 0 }),
      ctx,
    );
    expect(result).toContain("<dim>R0</dim>");
    expect(stripStyles(result)).toContain("R0");
  });

  it("omits banked reset segment when bankedResetCredits is undefined", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(build({ bankedResetCredits: undefined }), ctx),
    );
    expect(result).not.toContain("R");
  });

  it("handles bankedResetCredits=0 with no credits gracefully", () => {
    const result = stripStyles(
      formatCodexQuotaStatus(
        build({ bankedResetCredits: 0, remainingCredits: undefined }),
        ctx,
      ),
    );
    expect(result).toContain("R0");
    expect(result).not.toContain("C");
  });

  it("handles bankedResetCredits=3 with no credits gracefully", () => {
    const result = formatCodexQuotaStatus(
      build({ bankedResetCredits: 3, remainingCredits: undefined }),
      ctx,
    );
    expect(result).toContain("<accent>R3</accent>");
    expect(stripStyles(result)).toContain("R3");
    expect(stripStyles(result)).not.toContain("C");
  });
});
