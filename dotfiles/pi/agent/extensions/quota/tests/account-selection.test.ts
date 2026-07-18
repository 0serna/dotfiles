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
  oneState: SourceState = "current",
  oneWindows = true,
): QuotaSnapshot {
  const source = (
    name: string,
    remainingPercent: number,
    state: SourceState,
    complete = true,
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
    windows: complete
      ? {
          rolling: { remainingPercent, resetAt: NOW / 1000 + 1000 },
          weekly: { remainingPercent, resetAt: NOW / 1000 + 2000 },
          monthly: { remainingPercent, resetAt: NOW / 1000 + 3000 },
        }
      : { rolling: { remainingPercent, resetAt: NOW / 1000 + 1000 } },
  });
  return {
    version: 2,
    revision: 1,
    cycle: { cycleStartedAt: NOW, lastCompletedAt: NOW },
    sources: {
      "opencode-go/opencode-go:one": source("one", one, oneState, oneWindows),
      "opencode-go/opencode-go:two": source("two", two, "current"),
    },
  };
}

function activations(outcomes: AccountSelectionOutcome[]) {
  return outcomes.filter((outcome) => outcome.type === "activate-account");
}

describe("account selection interface", () => {
  it("selects the best complete observed account at startup", () => {
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

  it("does not activate an account without a selectable observation", () => {
    const selection = createAccountSelection({ accounts, env });
    expect(
      activations(
        selection.handle({
          type: "startup",
          snapshot: { ...snapshot(), sources: {} },
          now: NOW,
        }),
      ),
    ).toEqual([]);
    expect(selection.activeAccountName()).toBeUndefined();
  });

  it("accepts a stale retained observation at startup", () => {
    const selection = createAccountSelection({ accounts, env });
    expect(
      activations(
        selection.handle({
          type: "startup",
          snapshot: snapshot(90, 80, "stale"),
          now: NOW,
        }),
      ),
    ).toEqual([expect.objectContaining({ accountName: "one" })]);
  });

  it("does not select an incomplete observation", () => {
    const selection = createAccountSelection({ accounts, env });
    expect(
      activations(
        selection.handle({
          type: "startup",
          snapshot: snapshot(90, 80, "current", false),
          now: NOW,
        }),
      ),
    ).toEqual([expect.objectContaining({ accountName: "two" })]);
  });

  it("does not reselect when later snapshots change", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    expect(
      activations(
        selection.handle({
          type: "snapshot-revision",
          snapshot: snapshot(20, 99),
        }),
      ),
    ).toEqual([]);
    expect(selection.activeAccountName()).toBe("one");
  });

  it("rotates to the best eligible account after a runtime rejection", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
    });
    expect(outcomes.map((outcome) => outcome.type)).toEqual(
      expect.arrayContaining(["activate-account", "request-continuation"]),
    );
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "two" }),
    ]);
    expect(outcomes).not.toContainEqual(
      expect.objectContaining({ type: "record-exhaustion" }),
    );
  });

  it("skips accounts whose observed window is exhausted", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    const exhausted = snapshot(90, 0);
    exhausted.sources["opencode-go/opencode-go:two"]!.state = "current";
    selection.handle({ type: "snapshot-revision", snapshot: exhausted });

    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
    });
    expect(activations(outcomes)).toEqual([]);
    expect(outcomes).toContainEqual(
      expect.objectContaining({ type: "notify", level: "warning" }),
    );
  });

  it("does not request a continuation without an eligible replacement", () => {
    const selection = createAccountSelection({ accounts, env });
    selection.handle({ type: "startup", snapshot: snapshot(90, 80), now: NOW });
    const outcomes = selection.handle({
      type: "provider-exhausted",
      now: NOW + 1,
    });
    selection.handle({ type: "turn-start" });
    const exhausted = snapshot(0, 0);
    exhausted.sources["opencode-go/opencode-go:one"]!.state = "current";
    exhausted.sources["opencode-go/opencode-go:two"]!.state = "current";
    selection.handle({ type: "snapshot-revision", snapshot: exhausted });
    const unavailable = selection.handle({
      type: "provider-exhausted",
      now: NOW + 2,
    });

    expect(
      outcomes.some((outcome) => outcome.type === "request-continuation"),
    ).toBe(true);
    expect(
      unavailable.some((outcome) => outcome.type === "request-continuation"),
    ).toBe(false);
  });
});
