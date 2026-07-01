import { describe, expect, it } from "vitest";
import { formatCodexFullDetail, formatOpenCodeFullDetail } from "../status.js";
import type { CodexQuotaData, OpenCodeGoData } from "../types.js";
import { stripStyles } from "./helpers.js";

describe("formatCodexFullDetail", () => {
  function build(overrides: Partial<CodexQuotaData> = {}): CodexQuotaData {
    return {
      remaining5h: 80,
      remaining7d: 90,
      remainingCredits: 100,
      bankedResetCredits: 3,
      resetAt5h: 9999999999,
      resetAt7d: 9999999999,
      ...overrides,
    };
  }

  it("renders box with Codex header", () => {
    const lines = formatCodexFullDetail(build());
    expect(lines[0]).toContain("Codex");
    expect(lines[0]).toContain("┌");
    expect(lines[0]).toContain("┐");
  });

  it("renders rolling window row", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Rolling") && l.includes("80%"))).toBe(
      true,
    );
  });

  it("renders weekly window row", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Weekly") && l.includes("90%"))).toBe(
      true,
    );
  });

  it("renders credits row", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Credits") && l.includes("100"))).toBe(
      true,
    );
  });

  it("renders resets row", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Resets") && l.includes("3"))).toBe(
      true,
    );
  });

  it("omits credits when undefined", () => {
    const lines = formatCodexFullDetail(build({ remainingCredits: undefined }));
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Credits"))).toBe(false);
  });

  it("omits resets when undefined", () => {
    const lines = formatCodexFullDetail(
      build({ bankedResetCredits: undefined }),
    );
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Resets"))).toBe(false);
  });

  it("closes box with bottom border", () => {
    const lines = formatCodexFullDetail(build());
    expect(lines[lines.length - 1]).toContain("└");
    expect(lines[lines.length - 1]).toContain("┘");
  });
});

describe("formatOpenCodeFullDetail", () => {
  function build(overrides: Partial<OpenCodeGoData> = {}): OpenCodeGoData {
    return {
      rolling: { remainingPercent: 80, resetInSec: 60 },
      weekly: { remainingPercent: 70, resetInSec: 120 },
      monthly: { remainingPercent: 60, resetInSec: 180 },
      balanceDollars: 12.34,
      ...overrides,
    };
  }

  it("renders box with OpenCode Go header", () => {
    const lines = formatOpenCodeFullDetail(build());
    expect(lines[0]).toContain("OpenCode Go");
    expect(lines[0]).toContain("┌");
    expect(lines[0]).toContain("┐");
  });

  it("renders all window rows", () => {
    const lines = formatOpenCodeFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Rolling") && l.includes("80%"))).toBe(
      true,
    );
    expect(plain.some((l) => l?.includes("Weekly") && l.includes("70%"))).toBe(
      true,
    );
    expect(plain.some((l) => l?.includes("Monthly") && l.includes("60%"))).toBe(
      true,
    );
  });

  it("renders balance row", () => {
    const lines = formatOpenCodeFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(
      plain.some((l) => l?.includes("Balance") && l.includes("$12.34")),
    ).toBe(true);
  });

  it("omits balance when undefined", () => {
    const lines = formatOpenCodeFullDetail(
      build({ balanceDollars: undefined }),
    );
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Balance"))).toBe(false);
  });

  it("omits missing windows", () => {
    const lines = formatOpenCodeFullDetail(
      build({ weekly: undefined, monthly: undefined }),
    );
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Rolling"))).toBe(true);
    expect(plain.some((l) => l?.includes("Weekly"))).toBe(false);
    expect(plain.some((l) => l?.includes("Monthly"))).toBe(false);
  });

  it("closes box with bottom border", () => {
    const lines = formatOpenCodeFullDetail(build());
    expect(lines[lines.length - 1]).toContain("└");
    expect(lines[lines.length - 1]).toContain("┘");
  });
});
