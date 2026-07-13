import { describe, expect, it } from "vitest";
import { decidePreventiveReselection } from "../reselection.js";
import type { QuotaSnapshot, SourceIdentity } from "../snapshot.js";

const NOW_MS = 1_700_000_000_000;

function snapshot(active: SourceIdentity | null): QuotaSnapshot {
  return {
    version: 1,
    revision: 1,
    cycle: { cycleStartedAt: NOW_MS, lastCompletedAt: NOW_MS },
    sources: active
      ? {
          [`${active.providerId}/${active.sourceId}`]: {
            identity: active,
            descriptor: {
              identity: active,
              displayName: "OpenCode 1",
              compactPrefix: "OpenCode",
              configFingerprint: "f",
            },
            state: "fresh",
            observedAt: NOW_MS,
            lastSuccessAt: NOW_MS,
            windows: {
              rolling: { remainingPercent: 50, resetAt: 1_700_000_3600 },
              weekly: { remainingPercent: 50, resetAt: 1_700_000_7200 },
              monthly: { remainingPercent: 50, resetAt: 1_700_002_592_000 },
            },
          },
        }
      : {},
  };
}

describe("decidePreventiveReselection", () => {
  it("does not reselect when the active source is still usable", () => {
    const active: SourceIdentity = {
      providerId: "opencode-go",
      sourceId: "opencode-go:1",
    };
    const decision = decidePreventiveReselection(snapshot(active), {
      activeSource: active,
      piSettled: true,
      blindFallback: false,
      now: NOW_MS,
    });
    expect(decision.reselect).toBe(false);
  });

  it("reselects when the active source becomes exhausted and Pi is settled", () => {
    const active: SourceIdentity = {
      providerId: "opencode-go",
      sourceId: "opencode-go:1",
    };
    const snap = snapshot(active);
    snap.sources[`${active.providerId}/${active.sourceId}`]!.state =
      "exhausted";
    const decision = decidePreventiveReselection(snap, {
      activeSource: active,
      piSettled: true,
      blindFallback: false,
      now: NOW_MS,
    });
    expect(decision.reselect).toBe(true);
  });

  it("does not reselect while Pi is still processing", () => {
    const active: SourceIdentity = {
      providerId: "opencode-go",
      sourceId: "opencode-go:1",
    };
    const snap = snapshot(active);
    snap.sources[`${active.providerId}/${active.sourceId}`]!.state =
      "exhausted";
    const decision = decidePreventiveReselection(snap, {
      activeSource: active,
      piSettled: false,
      blindFallback: false,
      now: NOW_MS,
    });
    expect(decision.reselect).toBe(false);
  });

  it("performs a blind-fallback reevaluation when the first usable snapshot arrives", () => {
    const decision = decidePreventiveReselection(snapshot(null), {
      activeSource: undefined,
      piSettled: true,
      blindFallback: true,
      now: NOW_MS,
    });
    expect(decision.reselect).toBe(true);
  });
});
