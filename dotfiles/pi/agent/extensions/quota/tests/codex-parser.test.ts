import { describe, expect, it } from "vitest";
import { buildBankedResetDetails } from "../codex.js";
import type { CodexResetCreditsResponse } from "../types.js";

describe("buildBankedResetDetails", () => {
  it("returns undefined when response is null", () => {
    expect(buildBankedResetDetails(null)).toBeUndefined();
  });

  it("returns undefined when response has no credits array", () => {
    expect(buildBankedResetDetails({})).toBeUndefined();
    expect(buildBankedResetDetails({ available_count: 3 })).toBeUndefined();
  });

  it("returns empty array when credits array is empty", () => {
    expect(buildBankedResetDetails({ credits: [] })).toEqual([]);
  });

  it("filters out credits with non-available status", () => {
    const response: CodexResetCreditsResponse = {
      credits: [
        {
          status: "redeemed",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
      ],
    };
    expect(buildBankedResetDetails(response)).toHaveLength(1);
  });

  it("drops credits with invalid or missing expires_at", () => {
    const response: CodexResetCreditsResponse = {
      credits: [
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "not-a-date",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
      ],
    };
    const result = buildBankedResetDetails(response);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.status).toBe("available");
  });

  it("parses expires_at and granted_at to unix seconds", () => {
    const response: CodexResetCreditsResponse = {
      credits: [
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
      ],
    };
    const result = buildBankedResetDetails(response);
    expect(result?.[0]?.grantedAt).toBe(
      Math.floor(Date.parse("2026-06-01T00:00:00Z") / 1000),
    );
    expect(result?.[0]?.expiresAt).toBe(
      Math.floor(Date.parse("2026-07-01T00:00:00Z") / 1000),
    );
  });

  it("uses 0 as grantedAt fallback when granted_at is invalid", () => {
    const response: CodexResetCreditsResponse = {
      credits: [
        {
          status: "available",
          granted_at: "invalid",
          expires_at: "2026-07-01T00:00:00Z",
        },
      ],
    };
    const result = buildBankedResetDetails(response);
    expect(result?.[0]?.grantedAt).toBe(0);
  });

  it("sorts credits by expiresAt ascending", () => {
    const response: CodexResetCreditsResponse = {
      credits: [
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-08-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-09-01T00:00:00Z",
        },
      ],
    };
    const result = buildBankedResetDetails(response);
    expect(result).toHaveLength(3);
    const expires = result?.map((d) => d.expiresAt);
    expect(expires).toEqual(expires?.slice().sort((a, b) => a - b));
  });
});
