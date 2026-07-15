import { describe, expect, it } from "vitest";
import {
  createAccountSelection,
  type AccountSelectionOutcome,
} from "../account-selection.js";
import type { QuotaSnapshot, SourceState } from "../snapshot.js";
import type { AccountConfig } from "../types.js";

const NOW = 1_700_000_000_000;
const accounts: AccountConfig[] = [
  {
    name: "one",
    apiKeyEnv: "KEY_ONE",
    workspaceEnv: "WS_ONE",
    cookieEnv: "COOKIE_ONE",
  },
  {
    name: "two",
    apiKeyEnv: "KEY_TWO",
    workspaceEnv: "WS_TWO",
    cookieEnv: "COOKIE_TWO",
  },
];
const env = { KEY_ONE: "key-one", KEY_TWO: "key-two" };

function snapshot(
  one = 20,
  two = 80,
  oneState: SourceState = "fresh",
): QuotaSnapshot {
  const source = (
    name: string,
    remainingPercent: number,
    state: SourceState,
  ) => ({
    identity: { providerId: "opencode-go", sourceId: `opencode-go:${name}` },
    descriptor: {
      identity: { providerId: "opencode-go", sourceId: `opencode-go:${name}` },
      displayName: name,
      compactPrefix: "OpenCode",
      configFingerprint: name,
    },
    state,
    observedAt: NOW,
    lastSuccessAt: NOW,
    windows: {
      rolling: { remainingPercent, resetAt: NOW / 1000 + 1000 },
      weekly: { remainingPercent, resetAt: NOW / 1000 + 2000 },
      monthly: { remainingPercent, resetAt: NOW / 1000 + 3000 },
    },
  });
  return {
    version: 1,
    revision: 1,
    cycle: { cycleStartedAt: NOW, lastCompletedAt: NOW },
    sources: {
      "opencode-go/opencode-go:one": source("one", one, oneState),
      "opencode-go/opencode-go:two": source("two", two, "fresh"),
    },
  };
}

function activations(outcomes: AccountSelectionOutcome[]) {
  return outcomes.filter((outcome) => outcome.type === "activate-account");
}

describe("account selection interface", () => {
  it("selects the best observed account at startup", () => {
    const selection = createAccountSelection({ accounts, env });
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snapshot(),
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "two", apiKey: "key-two" }),
    ]);
  });

  it("uses the first configured account as a blind fallback", () => {
    const selection = createAccountSelection({ accounts, env });
    const outcomes = selection.handle({
      type: "startup",
      snapshot: { ...snapshot(), sources: {} },
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "one", apiKey: "key-one" }),
    ]);
  });

  it("defers preventive reselection until processing is settled", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    const exhausted = snapshot(90, 80, "exhausted");
    expect(
      activations(
        selection.handle({
          type: "snapshot-revision",
          snapshot: exhausted,
          idle: false,
          now: NOW + 1,
        }),
      ),
    ).toEqual([]);
    expect(
      activations(
        selection.handle({
          type: "processing-settled",
          idle: true,
          now: NOW + 2,
        }),
      ),
    ).toEqual([expect.objectContaining({ accountName: "two" })]);
  });

  it("rotates after provider-confirmed exhaustion and requests continuation", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
      reportedBy: "session-1",
    });
    expect(outcomes.map((outcome) => outcome.type)).toEqual(
      expect.arrayContaining([
        "record-exhaustion",
        "activate-account",
        "request-continuation",
      ]),
    );
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "two" }),
    ]);
  });

  it("stops after every account was attempted in one processing cycle", () => {
    const selection = createAccountSelection({ accounts, env, cooldownMs: 0 });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
      reportedBy: "s",
    });
    selection.handle({ type: "turn-start" });
    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 2,
      reportedBy: "s",
    });
    expect(
      outcomes.some((outcome) => outcome.type === "request-continuation"),
    ).toBe(false);
    expect(outcomes).toContainEqual(
      expect.objectContaining({ type: "notify", level: "warning" }),
    );
  });

  it("clears attempted accounts after the processing cycle settles", () => {
    const selection = createAccountSelection({ accounts, env, cooldownMs: 0 });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
      reportedBy: "s",
    });
    selection.handle({ type: "processing-settled", idle: true, now: NOW + 2 });
    selection.handle({ type: "turn-start" });
    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 3,
      reportedBy: "s",
    });
    expect(
      outcomes.some((outcome) => outcome.type === "request-continuation"),
    ).toBe(true);
  });
});
