import { describe, expect, it } from "vitest";
import { RecoveryState } from "../recovery-state.js";

describe("RecoveryState", () => {
  it("uses only the terminal assistant outcome before settlement", () => {
    const state = new RecoveryState();

    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });
    state.observeAssistantOutcome({ stopReason: "stop" });

    expect(state.settle()).toEqual({ kind: "none" });
  });

  it("lets a permanent terminal error replace a transient candidate", () => {
    const state = new RecoveryState();

    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "Connection error",
    });
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "Invalid request",
    });

    expect(state.settle()).toEqual({ kind: "none" });
  });

  it("offers one continuation for a terminal transient outcome", () => {
    const state = new RecoveryState();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "WebSocket error",
    });

    expect(state.settle()).toEqual({
      kind: "recover",
      signal: "WebSocket error",
    });
  });

  it("closes an episode when its Recovery Continuation also fails transiently", () => {
    const state = new RecoveryState();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });
    expect(state.settle().kind).toBe("recover");
    state.markRecoveryContinuationDispatched();

    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "Request timed out",
    });

    expect(state.settle()).toEqual({
      kind: "suppressed",
      signal: "Request timed out",
      reason: "episode-budget-exhausted",
    });
  });

  it("allows independently initiated later work to open a new episode", () => {
    const state = new RecoveryState();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });
    state.settle();
    state.markRecoveryContinuationDispatched();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });
    state.settle();

    state.startIndependentWork();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });

    expect(state.settle()).toEqual({
      kind: "recover",
      signal: "fetch failed",
    });
  });

  it("cancels an offered recovery permanently until independent work starts", () => {
    const state = new RecoveryState();
    state.observeAssistantOutcome({
      stopReason: "error",
      errorMessage: "fetch failed",
    });
    state.settle();
    state.cancelRecovery();

    expect(state.settle()).toEqual({ kind: "none" });
  });
});
