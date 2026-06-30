import { describe, expect, it } from "vitest";
import {
  clampPercent,
  formatCodexQuotaStatus,
  formatOpenCodeBalances,
  formatPercentResetSegment,
  formatProviderStatus,
  formatResetTime,
  parseCredits,
  toRemainingPercent,
} from "../status.js";
import type {
  CodexQuotaData,
  ExtensionContext,
  OpenCodeGoData,
} from "../types.js";

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
// Numeric helpers
// ---------------------------------------------------------------------------

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
// Percent segment formatting
// ---------------------------------------------------------------------------

describe("formatPercentResetSegment", () => {
  const ctx = makeContext();

  it("warns when remaining percent is below the threshold", () => {
    expect(formatPercentResetSegment(19, "12:00", ctx)).toBe(
      "<warning>19(12:00)</warning>",
    );
  });

  it("dims exhausted quota when warning is suppressed", () => {
    expect(formatPercentResetSegment(0, "12:00", ctx, true)).toBe(
      "<dim>0(12:00)</dim>",
    );
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

// ---------------------------------------------------------------------------
// formatOpenCodeBalances
// ---------------------------------------------------------------------------

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

  it("returns null when only partial window data is available", () => {
    expect(
      formatOpenCodeBalances(
        { rolling: { remainingPercent: 80, resetInSec: 60 } },
        ctx,
      ),
    ).toBeNull();
  });

  it("formats all windows and balance", () => {
    const result = stripStyles(formatOpenCodeBalances(build(), ctx));
    expect(result).toContain("80(");
    expect(result).toContain("70(");
    expect(result).toContain("60(");
    expect(result).toContain("$12.34");
  });

  it("formats only balance when windows are incomplete", () => {
    expect(
      formatOpenCodeBalances(
        {
          rolling: { remainingPercent: 80, resetInSec: 60 },
          balanceDollars: 12.34,
        },
        ctx,
      ),
    ).toBe("<dim>$12.34</dim>");
  });

  it("dims exhausted windows when consuming balance", () => {
    const result = formatOpenCodeBalances(
      build({ rolling: { remainingPercent: 0, resetInSec: 60 } }),
      ctx,
    );
    expect(result).toContain("<dim>0(");
    expect(result).toContain("<warning>$12.34</warning>");
  });
});

// ---------------------------------------------------------------------------
// formatProviderStatus
// ---------------------------------------------------------------------------

describe("formatProviderStatus", () => {
  const ctx = makeContext();

  it("formats provider errors", () => {
    expect(
      formatProviderStatus("OC", "fetch_failed", {}, () => "ok", ctx),
    ).toBe("<warning>OC error</warning>");
    expect(formatProviderStatus("OC", null, null, () => "ok", ctx)).toBe(
      "<warning>OC error</warning>",
    );
  });

  it("formats successful provider status", () => {
    expect(formatProviderStatus("OC", null, {}, () => "ok", ctx)).toBe(
      "<dim>OC </dim>ok",
    );
  });
});
