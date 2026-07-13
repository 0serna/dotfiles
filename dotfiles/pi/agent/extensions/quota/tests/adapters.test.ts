import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silentLogger } from "../adapter-test-utils.js";
import {
  codexAdapter,
  type CodexAdapterCredentials,
} from "../adapters/codex-adapter.js";
import { opencodeGoAdapter } from "../adapters/opencode-adapter.js";

const ABORT = new AbortController().signal;

function makeCredentials(
  overrides: Partial<CodexAdapterCredentials> = {},
): CodexAdapterCredentials {
  return {
    accessToken: "test-token",
    ...overrides,
  };
}

describe("opencodeGoAdapter.describe", () => {
  it("produces a non-secret descriptor with absolute window data", () => {
    const descriptor = opencodeGoAdapter.describe({
      providerId: "opencode-go",
      sourceId: "1",
    });
    expect(descriptor.identity).toEqual({
      providerId: "opencode-go",
      sourceId: "opencode-go:1",
    });
    expect(descriptor.displayName).toBe("OpenCode 1");
    expect(descriptor.compactPrefix).toBe("OC");
    expect(descriptor.configFingerprint).not.toContain("cookie");
  });
});

describe("opencodeGoAdapter.fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns skipped when credentials are missing", async () => {
    const result = await opencodeGoAdapter.fetch(
      { providerId: "opencode-go", sourceId: "1" },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("skipped");
  });

  it("normalizes resetInSec to an absolute reset timestamp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(dashboardHtml())),
    );
    const result = await opencodeGoAdapter.fetch(
      {
        providerId: "opencode-go",
        sourceId: "1",
        credentials: {
          workspaceId: "ws-1",
          authCookie: "auth=cookie",
        },
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.windows.rolling).toBeDefined();
    const rolling = result.windows.rolling!;
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(rolling.resetAt).toBeGreaterThanOrEqual(nowSeconds + 9);
    expect(rolling.resetAt).toBeLessThanOrEqual(nowSeconds + 11);
    expect(rolling.remainingPercent).toBe(100);
  });

  it("applies a 15-second request timeout", async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      ),
    );

    const resultPromise = opencodeGoAdapter.fetch(
      {
        providerId: "opencode-go",
        sourceId: "1",
        credentials: { workspaceId: "ws-1", authCookie: "auth=cookie" },
      },
      ABORT,
      silentLogger,
    );
    await Promise.resolve();
    try {
      expect(timeoutSpy).toHaveBeenCalledWith(15_000);
    } finally {
      timeoutController.abort(new Error("request timeout"));
    }

    await expect(resultPromise).resolves.toMatchObject({ state: "error" });
  });

  it("honors the abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn());
    const result = await opencodeGoAdapter.fetch(
      {
        providerId: "opencode-go",
        sourceId: "1",
        credentials: { workspaceId: "ws-1", authCookie: "auth=cookie" },
      },
      controller.signal,
      silentLogger,
    );
    expect(result.state).toBe("error");
  });

  it("returns error result when the dashboard returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 })),
    );
    const result = await opencodeGoAdapter.fetch(
      {
        providerId: "opencode-go",
        sourceId: "1",
        credentials: { workspaceId: "ws-1", authCookie: "auth=cookie" },
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("error");
  });
});

describe("codexAdapter.describe", () => {
  it("produces a non-secret descriptor", () => {
    const descriptor = codexAdapter.describe({
      providerId: "openai-codex",
      sourceId: "codex-login",
    });
    expect(descriptor.identity).toEqual({
      providerId: "openai-codex",
      sourceId: "codex-login",
    });
    expect(descriptor.configFingerprint).not.toContain("Bearer");
  });
});

describe("codexAdapter.fetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("skips network fetching when the access token is missing", async () => {
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials({ accessToken: "" }),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("skipped");
    if (result.state !== "skipped") return;
    expect(result.reason).toBe("auth_missing");
  });

  it("applies a 15-second request timeout", async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      ),
    );

    const resultPromise = codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    await Promise.resolve();
    try {
      expect(timeoutSpy).toHaveBeenCalledWith(15_000);
    } finally {
      timeoutController.abort(new Error("request timeout"));
    }

    await expect(resultPromise).resolves.toMatchObject({ state: "error" });
  });

  it("publishes successful usage and marks reset credits as unavailable when the reset endpoint fails", async () => {
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: { used_percent: 20, reset_at: 1_700_000_000 },
        secondary_window: { remaining_percent: 90, reset_at: 1_700_000_999 },
      },
      credits: { balance: 100 },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.windows.rolling?.remainingPercent).toBe(80);
    expect(result.windows.weekly?.remainingPercent).toBe(90);
    expect(result.extras?.bankedResets).toEqual({ kind: "unavailable" });
  });

  it("publishes reset details with R0 when the endpoint returns an empty credits list", async () => {
    const usageJson = JSON.stringify({
      rate_limit: { primary_window: { remaining_percent: 80 } },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ credits: [] }), { status: 200 }),
      );
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.extras?.bankedResets).toEqual({ kind: "empty" });
  });

  it("filters, parses, and sorts available banked resets", async () => {
    const usageJson = JSON.stringify({
      rate_limit: { primary_window: { remaining_percent: 80 } },
    });
    const resetJson = JSON.stringify({
      credits: [
        {
          status: "available",
          granted_at: "invalid",
          expires_at: "2026-08-01T00:00:00Z",
        },
        {
          status: "redeemed",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-07-01T00:00:00Z",
        },
        {
          status: "available",
          granted_at: "2026-06-01T00:00:00Z",
          expires_at: "not-a-date",
        },
      ],
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(resetJson, { status: 200 }));

    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );

    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.extras?.bankedResets).toEqual({
      kind: "available",
      details: [
        {
          grantedAt: Date.parse("2026-06-01T00:00:00Z") / 1000,
          expiresAt: Date.parse("2026-07-01T00:00:00Z") / 1000,
          status: "available",
        },
        {
          grantedAt: 0,
          expiresAt: Date.parse("2026-08-01T00:00:00Z") / 1000,
          status: "available",
        },
      ],
    });
  });

  it("classifies windows by limit_window_seconds when primary is weekly and secondary is rolling", async () => {
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: {
          remaining_percent: 90,
          reset_at: 1_700_000_999,
          limit_window_seconds: 604800,
        },
        secondary_window: {
          used_percent: 20,
          reset_at: 1_700_000_000,
          limit_window_seconds: 18000,
        },
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // secondary (18000s / 5h) → rolling, primary (604800s / 7d) → weekly
    expect(result.windows.rolling?.remainingPercent).toBe(80);
    expect(result.windows.weekly?.remainingPercent).toBe(90);
  });

  it("classifies a single window by duration: short → rolling, long → weekly", async () => {
    // Single window with 7d duration → should be weekly, not rolling
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: {
          remaining_percent: 70,
          reset_at: 1_700_000_000,
          limit_window_seconds: 604800,
        },
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.windows.rolling).toBeUndefined();
    expect(result.windows.weekly?.remainingPercent).toBe(70);
  });

  it("classifies by partial duration: primary has duration, secondary doesn't", async () => {
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: {
          remaining_percent: 90,
          reset_at: 1_700_000_000,
          limit_window_seconds: 604800,
        },
        secondary_window: {
          used_percent: 15,
          reset_at: 1_700_000_999,
        },
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // primary (604800s / 7d) → weekly, secondary (no duration) → rolling
    expect(result.windows.weekly?.remainingPercent).toBe(90);
    expect(result.windows.rolling?.remainingPercent).toBe(85);
  });

  it("classifies by partial duration: secondary has duration, primary doesn't", async () => {
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: {
          used_percent: 30,
          reset_at: 1_700_000_000,
        },
        secondary_window: {
          remaining_percent: 85,
          reset_at: 1_700_000_999,
          limit_window_seconds: 3600,
        },
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // secondary (3600s / 1h) → rolling, primary (no duration) → weekly
    expect(result.windows.rolling?.remainingPercent).toBe(85);
    expect(result.windows.weekly?.remainingPercent).toBe(70);
  });

  it("falls back to positional mapping when limit_window_seconds is absent", async () => {
    const usageJson = JSON.stringify({
      rate_limit: {
        primary_window: { used_percent: 30, reset_at: 1_700_000_000 },
        secondary_window: { remaining_percent: 85, reset_at: 1_700_000_999 },
      },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(usageJson, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const result = await codexAdapter.fetch(
      {
        providerId: "openai-codex",
        sourceId: "codex-login",
        credentials: makeCredentials(),
      },
      ABORT,
      silentLogger,
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // No duration → positional: primary = rolling, secondary = weekly
    expect(result.windows.rolling?.remainingPercent).toBe(70);
    expect(result.windows.weekly?.remainingPercent).toBe(85);
  });
});

function dashboardHtml(): string {
  return `<script>rollingUsage:$R[0]={usagePercent:0,resetInSec:10};weeklyUsage:$R[1]={usagePercent:10,resetInSec:20};monthlyUsage:$R[2]={usagePercent:20,resetInSec:30};balance:100000000;</script>`;
}
