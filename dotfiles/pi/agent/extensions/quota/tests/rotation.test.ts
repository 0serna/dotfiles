import { describe, expect, it } from "vitest";
import {
  DEFAULT_COOLDOWN_MS,
  initAccountStates,
  isAvailable,
  isQuotaExhaustionError,
  markBad,
  pickBestQuotaAccount,
  pickNextAccount,
} from "../rotation.js";
import type { AccountConfig, AccountState, OpenCodeGoData } from "../types.js";

describe("initAccountStates", () => {
  it("creates a state for each configured account with an API key", () => {
    const accounts: AccountConfig[] = [
      {
        name: "1",
        apiKeyEnv: "KEY_1",
        workspaceEnv: "WS_1",
        cookieEnv: "CK_1",
      },
      {
        name: "2",
        apiKeyEnv: "KEY_2",
        workspaceEnv: "WS_2",
        cookieEnv: "CK_2",
      },
    ];
    const env = { KEY_1: "key-one", KEY_2: "key-two" };
    const states = initAccountStates(accounts, env);
    expect(states).toHaveLength(2);
    expect(states[0]?.name).toBe("1");
    expect(states[0]?.apiKey).toBe("key-one");
    expect(states[1]?.name).toBe("2");
    expect(states[1]?.apiKey).toBe("key-two");
  });

  it("skips accounts whose API key env var is missing", () => {
    const accounts: AccountConfig[] = [
      {
        name: "1",
        apiKeyEnv: "KEY_1",
        workspaceEnv: "WS_1",
        cookieEnv: "CK_1",
      },
      {
        name: "2",
        apiKeyEnv: "KEY_2",
        workspaceEnv: "WS_2",
        cookieEnv: "CK_2",
      },
    ];
    const env = { KEY_1: "key-one" };
    const states = initAccountStates(accounts, env);
    expect(states).toHaveLength(1);
    expect(states[0]?.name).toBe("1");
  });

  it("returns an empty array when no accounts are configured", () => {
    expect(initAccountStates([])).toHaveLength(0);
  });
});

describe("isAvailable", () => {
  it("returns true for an untried account", () => {
    const state = makeState("1");
    expect(isAvailable(state, Date.now())).toBe(true);
  });

  it("returns false for an account still in cooldown", () => {
    const state = makeState("1");
    const now = Date.now();
    markBad(state, "rate-limited", DEFAULT_COOLDOWN_MS, now);
    expect(isAvailable(state, now + 1)).toBe(false);
    expect(isAvailable(state, now + DEFAULT_COOLDOWN_MS - 1)).toBe(false);
  });

  it("returns true once cooldown expires", () => {
    const state = makeState("1");
    const now = Date.now();
    markBad(state, "rate-limited", DEFAULT_COOLDOWN_MS, now);
    expect(isAvailable(state, now + DEFAULT_COOLDOWN_MS)).toBe(true);
  });
});

describe("pickBestQuotaAccount", () => {
  it("rejects an account with exhausted monthly quota", () => {
    const selected = pickBestQuotaAccount([
      quota("1", {
        monthly: window(0),
        weekly: window(88),
        rolling: window(100),
      }),
      quota("2", {
        monthly: window(60),
        weekly: window(70),
        rolling: window(80),
      }),
    ]);

    expect(selected).toBe(1);
  });

  it("rejects an account when a quota window is missing", () => {
    const selected = pickBestQuotaAccount([
      quota("1", { monthly: window(90), weekly: window(90) }),
      quota("2", {
        monthly: window(80),
        weekly: window(80),
        rolling: window(80),
      }),
    ]);

    expect(selected).toBe(1);
  });

  it("maximizes the smallest remaining window", () => {
    const selected = pickBestQuotaAccount([
      quota("1", {
        monthly: window(90),
        weekly: window(5),
        rolling: window(90),
      }),
      quota("2", {
        monthly: window(80),
        weekly: window(80),
        rolling: window(80),
      }),
    ]);

    expect(selected).toBe(1);
  });

  it("uses monthly, weekly, then rolling as tie-breakers", () => {
    const selected = pickBestQuotaAccount([
      quota("1", {
        monthly: window(70),
        weekly: window(80),
        rolling: window(80),
      }),
      quota("2", {
        monthly: window(80),
        weekly: window(70),
        rolling: window(80),
      }),
      quota("3", {
        monthly: window(80),
        weekly: window(80),
        rolling: window(70),
      }),
    ]);

    expect(selected).toBe(2);
  });

  it("returns -1 when no account has all windows available", () => {
    const selected = pickBestQuotaAccount([
      quota("1", {
        monthly: window(0),
        weekly: window(100),
        rolling: window(100),
      }),
      quota("2", null),
    ]);

    expect(selected).toBe(-1);
  });
});

describe("pickNextAccount", () => {
  it("selects index 0 when there are no previous failures", () => {
    const states = [makeState("1"), makeState("2")];
    expect(pickNextAccount(states, 0, Date.now())).toBe(0);
  });

  it("prefers the current index when it is available", () => {
    const states = [makeState("1"), makeState("2")];
    expect(pickNextAccount(states, 1, Date.now())).toBe(1);
  });

  it("rotates to the next account when current is on cooldown", () => {
    const states = [makeState("1"), makeState("2")];
    const now = Date.now();
    markBad(states[0]!, "rate-limited", DEFAULT_COOLDOWN_MS, now);
    expect(pickNextAccount(states, 0, now + 1)).toBe(1);
  });

  it("wraps around when rotating past the last account", () => {
    const states = [makeState("1"), makeState("2")];
    const now = Date.now();
    markBad(states[1]!, "rate-limited", DEFAULT_COOLDOWN_MS, now);
    expect(pickNextAccount(states, 1, now + 1)).toBe(0);
  });

  it("returns -1 when there are no accounts", () => {
    expect(pickNextAccount([], 0, Date.now())).toBe(-1);
  });

  it("returns the account with the soonest-expiring cooldown when all are bad", () => {
    const now = Date.now();
    const states = [makeState("1"), makeState("2"), makeState("3")];
    markBad(states[0]!, "rate-limited", 1000, now);
    markBad(states[1]!, "rate-limited", 500, now);
    markBad(states[2]!, "rate-limited", 2000, now);
    expect(pickNextAccount(states, 0, now + 1)).toBe(1);
  });
});

describe("markBad", () => {
  it("records rate-limited status and increments failures", () => {
    const state = makeState("1");
    const now = Date.now();
    markBad(state, "rate-limited", DEFAULT_COOLDOWN_MS, now);
    expect(state.lastStatus).toBe("rate-limited");
    expect(state.failures).toBe(1);
    expect(state.cooldownUntil).toBe(now + DEFAULT_COOLDOWN_MS);
  });

  it("records unauthorized status", () => {
    const state = makeState("1");
    markBad(state, "unauthorized", DEFAULT_COOLDOWN_MS, Date.now());
    expect(state.lastStatus).toBe("unauthorized");
  });
});

describe("isQuotaExhaustionError", () => {
  it("returns true for messages containing GoUsageLimitError", () => {
    expect(
      isQuotaExhaustionError(
        '429: {"type":"GoUsageLimitError","error":"quota exceeded"}',
      ),
    ).toBe(true);
  });

  it("returns true when GoUsageLimitError appears anywhere in the message", () => {
    expect(isQuotaExhaustionError("Some prefix GoUsageLimitError tail")).toBe(
      true,
    );
  });

  it("returns false for timeout errors", () => {
    expect(isQuotaExhaustionError("Request timed out.")).toBe(false);
  });

  it("returns false for stream interruption errors", () => {
    expect(isQuotaExhaustionError("Stream ended without finish_reason")).toBe(
      false,
    );
  });

  it("returns false when errorMessage is undefined", () => {
    expect(isQuotaExhaustionError(undefined)).toBe(false);
  });
});

function quota(name: string, data: OpenCodeGoData | null) {
  const account: AccountConfig = {
    name,
    apiKeyEnv: `KEY_${name}`,
    workspaceEnv: `WS_${name}`,
    cookieEnv: `CK_${name}`,
  };
  return { account, data };
}

function window(remainingPercent: number) {
  return { remainingPercent, resetInSec: 3600 };
}

function makeState(name: string): AccountState {
  return {
    name,
    apiKey: `key-${name}`,
    lastStatus: "untried",
    cooldownUntil: 0,
    failures: 0,
  };
}
