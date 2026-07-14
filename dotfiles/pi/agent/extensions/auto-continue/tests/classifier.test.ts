import { describe, expect, it } from "vitest";
import {
  classifyTransientFailure,
  type TransientFailureSignal,
} from "../classifier.js";

const supportedSignals: TransientFailureSignal[] = [
  "fetch failed",
  "WebSocket error",
  "Connection error",
  "Request timed out",
  "Streaming response failed",
  "Stream ended without finish_reason",
  "You can retry your request",
];

describe("classifyTransientFailure", () => {
  it.each(supportedSignals)("classifies %s case-insensitively", (signal) => {
    expect(
      classifyTransientFailure(`PREFIX ${signal.toUpperCase()} suffix`),
    ).toBe(signal);
  });

  it.each([
    "Codex error",
    "retry",
    "HTTP 429 Too Many Requests",
    "HTTP 500 Internal Server Error",
    "HTTP 503 Service Unavailable",
    "Invalid request",
  ])("does not classify permanent or broad error text: %s", (errorMessage) => {
    expect(classifyTransientFailure(errorMessage)).toBeUndefined();
  });

  it("classifies the same signal independently of provider identity", () => {
    const classifyForProvider = (_provider: string, errorMessage: string) =>
      classifyTransientFailure(errorMessage);

    expect(classifyForProvider("openai-codex", "fetch failed")).toBe(
      classifyForProvider("anthropic", "fetch failed"),
    );
  });

  it("does not classify a missing error message", () => {
    expect(classifyTransientFailure(undefined)).toBeUndefined();
  });
});
