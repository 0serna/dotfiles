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

/** Build a snapshot for two accounts with configurable reset offsets (seconds from NOW). */
function snapshot(
  one = 20,
  two = 80,
  oneState: SourceState = "current",
  oneWindows = true,
  opts?: {
    monthly?: number;
    weekly?: number;
    rolling?: number;
  },
): QuotaSnapshot {
  const monthlyOffset = opts?.monthly ?? 604_800; // 7 days
  const weeklyOffset = opts?.weekly ?? 259_200; // 3 days
  const rollingOffset = opts?.rolling ?? 86_400; // 24 hours
  const source = (
    name: string,
    remainingPercent: number,
    state: SourceState,
    complete = true,
    overrides?: { monthly?: number; weekly?: number; rolling?: number },
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
          rolling: {
            remainingPercent,
            resetAt: NOW / 1000 + (overrides?.rolling ?? rollingOffset),
          },
          weekly: {
            remainingPercent,
            resetAt: NOW / 1000 + (overrides?.weekly ?? weeklyOffset),
          },
          monthly: {
            remainingPercent,
            resetAt: NOW / 1000 + (overrides?.monthly ?? monthlyOffset),
          },
        }
      : { rolling: { remainingPercent, resetAt: NOW / 1000 + 1000 } },
  });
  return {
    version: 2,
    revision: 1,
    cycle: { cycleStartedAt: NOW, lastCompletedAt: NOW },
    sources: {
      "opencode-go/opencode-go:one": source(
        "one",
        one,
        oneState,
        oneWindows,
        opts,
      ),
      "opencode-go/opencode-go:two": source("two", two, "current", true, opts),
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

  it("prefers the account whose quota expires sooner even with lower percentage", () => {
    // Account "one": 20% monthly resetting in 2 days → urgency 10%/day
    // Account "two": 60% monthly resetting in 15 days → urgency 4%/day
    const selection = createAccountSelection({ accounts, env });
    const snap = snapshot(20, 60, "current", true, {
      monthly: 2 * 86400, // 2 days for "one"
    });
    // Override "two" monthly offset to 15 days
    snap.sources["opencode-go/opencode-go:two"]!.windows!.monthly!.resetAt =
      NOW / 1000 + 15 * 86400;
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snap,
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "one" }),
    ]);
  });

  it("assigns sentinel urgency to accounts resetting within one hour", () => {
    // Account "one": 5% resetting in 30 minutes → sentinel
    // Account "two": 80% resetting in 3 days → normal urgency (26.67%/day)
    const selection = createAccountSelection({ accounts, env });
    const snap = snapshot(5, 80, "current", true, {
      monthly: 30 * 60, // 30 minutes for both initially
    });
    // Override "two" to reset in 3 days
    snap.sources["opencode-go/opencode-go:two"]!.windows!.monthly!.resetAt =
      NOW / 1000 + 3 * 86400;
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snap,
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "one" }),
    ]);
  });

  it("breaks sentinel ties by selecting the account with smaller daysUntilReset", () => {
    // Both reset within 1 hour; "one" in 10 min, "two" in 45 min → "one" wins
    const selection = createAccountSelection({ accounts, env });
    const snap = snapshot(50, 50, "current", true, {
      monthly: 10 * 60, // 10 minutes for "one"
    });
    snap.sources["opencode-go/opencode-go:two"]!.windows!.monthly!.resetAt =
      NOW / 1000 + 45 * 60;
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snap,
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "one" }),
    ]);
  });

  it("uses monthly window for urgency even when weekly resets sooner", () => {
    // Both accounts have all three windows.
    // "one": monthly 50% reset in 14 days (urgency 3.57%/d), weekly 50% reset in 1 day
    // "two": monthly 50% reset in 7 days (urgency 7.14%/d), weekly 50% reset in 14 days
    // The urgency uses monthly, so "two" wins despite "one" having sooner weekly.
    const selection = createAccountSelection({ accounts, env });
    const snap = snapshot(50, 50, "current", true, {
      monthly: 14 * 86400,
      weekly: 1 * 86400,
    });
    // "two": monthly sooner, weekly later
    const two = snap.sources["opencode-go/opencode-go:two"]!;
    two.windows!.monthly!.resetAt = NOW / 1000 + 7 * 86400;
    two.windows!.weekly!.resetAt = NOW / 1000 + 14 * 86400;
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snap,
      now: NOW,
    });
    // "two" wins because monthly urgency 50/7 > 50/14
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "two" }),
    ]);
  });

  it("skips account with a zero window even when urgency would be high", () => {
    // "one" has great urgency but rolling is at 0% → ineligible
    const selection = createAccountSelection({ accounts, env });
    const snap = snapshot(90, 10, "current", true, {
      monthly: 1 * 86400, // 1 day → very high urgency for "one"
      weekly: 7 * 86400,
      rolling: 7 * 86400,
    });
    // Set "one" rolling to 0%
    snap.sources[
      "opencode-go/opencode-go:one"
    ]!.windows!.rolling!.remainingPercent = 0;
    const outcomes = selection.handle({
      type: "startup",
      snapshot: snap,
      now: NOW,
    });
    expect(activations(outcomes)).toEqual([
      expect.objectContaining({ accountName: "two" }),
    ]);
  });
});
