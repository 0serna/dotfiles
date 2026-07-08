import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
  computeThroughput,
  estimateTokensFromDelta,
  formatThroughput,
  isOutputDeltaEvent,
} from "../core.ts";

type AnyAssistantMessageEvent = AssistantMessageEvent & Record<string, unknown>;

describe("estimateTokensFromDelta", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokensFromDelta("")).toBe(0);
  });

  it("estimates 1 token per 4 characters", () => {
    expect(estimateTokensFromDelta("abcd")).toBe(1);
    expect(estimateTokensFromDelta("abcdefgh")).toBe(2);
  });

  it("rounds up for non-multiples of 4", () => {
    expect(estimateTokensFromDelta("abcde")).toBe(2); // ceil(5/4)
    expect(estimateTokensFromDelta("a")).toBe(1);
  });

  it("handles multi-byte characters", () => {
    // Emoji is 2 chars in JS
    expect(estimateTokensFromDelta("🚀")).toBe(1); // ceil(2/4) = 1
  });
});

describe("formatThroughput", () => {
  it("formats integer value", () => {
    expect(formatThroughput(42)).toBe("42 tok/s");
  });

  it("rounds to nearest integer", () => {
    expect(formatThroughput(42.4)).toBe("42 tok/s");
    expect(formatThroughput(42.5)).toBe("43 tok/s");
    expect(formatThroughput(42.6)).toBe("43 tok/s");
  });

  it("formats zero", () => {
    expect(formatThroughput(0)).toBe("0 tok/s");
  });

  it("formats large values", () => {
    expect(formatThroughput(1234.7)).toBe("1235 tok/s");
  });
});

describe("computeThroughput", () => {
  it("returns null for zero elapsed time", () => {
    expect(computeThroughput(100, 0)).toBeNull();
  });

  it("returns null for negative elapsed time", () => {
    expect(computeThroughput(100, -1000)).toBeNull();
  });

  it("returns null for zero tokens", () => {
    expect(computeThroughput(0, 1000)).toBeNull();
  });

  it("returns null when elapsed < 1 second", () => {
    expect(computeThroughput(100, 999)).toBeNull();
  });

  it("computes throughput for valid inputs", () => {
    // 100 tokens over 2 seconds = 50 tok/s
    expect(computeThroughput(100, 2000)).toBe(50);
  });

  it("computes fractional throughput", () => {
    // 150 tokens over 2 seconds = 75 tok/s
    expect(computeThroughput(150, 2000)).toBe(75);
  });

  it("allows exactly 1 second", () => {
    expect(computeThroughput(100, 1000)).toBe(100);
  });
});

describe("isOutputDeltaEvent", () => {
  it("returns true for text_delta", () => {
    expect(
      isOutputDeltaEvent({
        type: "text_delta",
        contentIndex: 0,
        delta: "hello",
        partial: {} as unknown,
      } as AnyAssistantMessageEvent),
    ).toBe(true);
  });

  it("returns true for thinking_delta", () => {
    expect(
      isOutputDeltaEvent({
        type: "thinking_delta",
        contentIndex: 0,
        delta: "hmm",
        partial: {} as unknown,
      } as AnyAssistantMessageEvent),
    ).toBe(true);
  });

  it("returns true for toolcall_delta", () => {
    expect(
      isOutputDeltaEvent({
        type: "toolcall_delta",
        contentIndex: 0,
        delta: "args",
        partial: {} as unknown,
      } as AnyAssistantMessageEvent),
    ).toBe(true);
  });

  it("returns false for text_start", () => {
    expect(
      isOutputDeltaEvent({
        type: "text_start",
        contentIndex: 0,
        partial: {} as unknown,
      } as AnyAssistantMessageEvent),
    ).toBe(false);
  });

  it("returns false for done", () => {
    expect(
      isOutputDeltaEvent({
        type: "done",
        reason: "stop",
        message: {} as unknown,
      } as AnyAssistantMessageEvent),
    ).toBe(false);
  });
});
