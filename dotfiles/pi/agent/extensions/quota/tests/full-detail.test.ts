import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCodexFullDetail, formatOpenCodeFullDetail } from "../status.js";
import type {
  BankedResetDetail,
  CodexQuotaData,
  OpenCodeGoData,
} from "../types.js";
import { stripStyles } from "./helpers.js";

describe("formatCodexFullDetail", () => {
  const NOW_SECONDS = 1_700_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SECONDS * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function resets(count: number, daysAhead: number[]): BankedResetDetail[] {
    return Array.from({ length: count }, (_, i) => ({
      expiresAt: NOW_SECONDS + (daysAhead[i] ?? 0) * 24 * 60 * 60,
      grantedAt: NOW_SECONDS - 7 * 24 * 60 * 60,
      status: "available",
    }));
  }

  function build(overrides: Partial<CodexQuotaData> = {}): CodexQuotaData {
    return {
      remaining5h: 80,
      remaining7d: 90,
      remainingCredits: 100,
      bankedResetDetails: resets(3, [30, 27, 12]),
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

  it("renders resets row with count", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Resets") && l.includes("3"))).toBe(
      true,
    );
  });

  it("aligns scalar values with percentage values", () => {
    const codexLines = formatCodexFullDetail(
      build({ remainingCredits: 0, bankedResetDetails: [] }),
    );
    const openCodeLines = formatOpenCodeFullDetail({
      rolling: { remainingPercent: 80, resetInSec: 60 },
      balanceDollars: 3.68,
    });

    const valueStarts = [
      valueStart(codexLines, "Rolling", "  80%"),
      valueStart(codexLines, "Credits", "    0"),
      valueStart(codexLines, "Resets", "    0"),
      valueStart(openCodeLines, "Balance", "$3.68"),
    ];

    expect(new Set(valueStarts).size).toBe(1);
  });

  it("renders one sub-line per reset with relative expiry", () => {
    const lines = formatCodexFullDetail(build());
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("#1 in 30d"))).toBe(true);
    expect(plain.some((l) => l?.includes("#2 in 27d"))).toBe(true);
    expect(plain.some((l) => l?.includes("#3 in 12d"))).toBe(true);
  });

  it("renders sub-lines in the order provided", () => {
    const lines = formatCodexFullDetail(
      build({ bankedResetDetails: resets(3, [12, 27, 30]) }),
    );
    const plain = lines.map(stripStyles);
    const idx1 = plain.findIndex((l) => l?.includes("#1"));
    const idx2 = plain.findIndex((l) => l?.includes("#2"));
    const idx3 = plain.findIndex((l) => l?.includes("#3"));
    expect(plain[idx1]).toContain("in 12d");
    expect(plain[idx2]).toContain("in 27d");
    expect(plain[idx3]).toContain("in 30d");
  });

  it("renders Resets 0 without sub-lines when details is empty", () => {
    const lines = formatCodexFullDetail(build({ bankedResetDetails: [] }));
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Resets") && l.includes("0"))).toBe(
      true,
    );
    expect(plain.some((l) => l?.includes("#1"))).toBe(false);
  });

  it("renders sub-line as 'expired' for past expiresAt", () => {
    const lines = formatCodexFullDetail(
      build({ bankedResetDetails: resets(1, [-1]) }),
    );
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("#1") && l.includes("expired"))).toBe(
      true,
    );
  });

  it("omits credits when undefined", () => {
    const lines = formatCodexFullDetail(build({ remainingCredits: undefined }));
    const plain = lines.map(stripStyles);
    expect(plain.some((l) => l?.includes("Credits"))).toBe(false);
  });

  it("omits resets when details is undefined", () => {
    const lines = formatCodexFullDetail(
      build({ bankedResetDetails: undefined }),
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

  it("renders box with OpenCode Go header by default", () => {
    const lines = formatOpenCodeFullDetail(build());
    expect(lines[0]).toContain("OpenCode Go");
    expect(lines[0]).toContain("┌");
    expect(lines[0]).toContain("┐");
  });

  it("renders box with account name when provided", () => {
    const lines = formatOpenCodeFullDetail(build(), "1");
    expect(lines[0]).toContain("OpenCode 1");
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

  it("aligns reset labels after percentages of different widths", () => {
    const lines = formatOpenCodeFullDetail(
      build({
        rolling: { remainingPercent: 100, resetInSec: 60 },
        weekly: { remainingPercent: 8, resetInSec: 120 },
        monthly: { remainingPercent: 0, resetInSec: 180 },
      }),
    );
    const rows = lines
      .map(stripStyles)
      .filter((line): line is string => line != null)
      .filter((line) =>
        ["Rolling", "Weekly", "Monthly"].some((label) => line.includes(label)),
      );

    expect(new Set(rows.map((row) => row.indexOf("%"))).size).toBe(1);
    expect(new Set(rows.map((row) => row.indexOf("reset"))).size).toBe(1);
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

function valueStart(lines: string[], label: string, value: string): number {
  const line = lines
    .map(stripStyles)
    .find((candidate) => candidate?.includes(label));
  expect(line).toBeDefined();
  return line!.indexOf(value);
}
