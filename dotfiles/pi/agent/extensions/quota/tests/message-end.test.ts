import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the extension module
// ---------------------------------------------------------------------------

const accountsJson = {
  provider: "opencode-go",
  accounts: [
    {
      name: "1",
      apiKeyEnv: "OC_GO_API_KEY_1",
      workspaceEnv: "OC_GO_WORKSPACE_1",
      cookieEnv: "OC_GO_COOKIE_1",
    },
    {
      name: "2",
      apiKeyEnv: "OC_GO_API_KEY_2",
      workspaceEnv: "OC_GO_WORKSPACE_2",
      cookieEnv: "OC_GO_COOKIE_2",
    },
  ],
};

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify([accountsJson])),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi
    .fn()
    .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  chmod: vi.fn().mockResolvedValue(undefined),
  open: vi
    .fn()
    .mockRejectedValue(Object.assign(new Error("EEXIST"), { code: "EEXIST" })),
  watch: vi.fn().mockReturnValue({ close: () => undefined }),
}));

vi.mock("../loading.js", () => ({
  withQuotaNotification: vi.fn(async (_ctx: unknown, op: () => unknown) =>
    op(),
  ),
}));

vi.mock("../lifecycle.js", () => ({
  createQuotaLifecycle: vi.fn(() => ({
    onSnapshot: vi.fn(),
    onStatus: vi.fn(),
    setActiveSource: vi.fn(),
    read: vi.fn().mockResolvedValue({
      version: 1,
      revision: 1,
      cycle: { cycleStartedAt: 0 },
      sources: {},
    }),
    start: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    coordinator: vi.fn().mockReturnValue({
      recordExhaustion: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

const logEvents: Array<{ event: string; data?: Record<string, unknown> }> = [];
vi.mock("../../shared/logger.js", () => ({
  createExtensionLogger: vi.fn().mockReturnValue({
    log(event: string, data?: Record<string, unknown>) {
      logEvents.push({ event, data });
    },
  }),
}));

// Now safe to import the extension
const extensionFactory = (await import("../index.ts")).default;
const { createQuotaLifecycle } = await import("../lifecycle.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

function createMockPi() {
  const handlers: Record<string, Handler> = {};
  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
    sendUserMessage: vi.fn().mockResolvedValue(undefined),
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;
  return { pi, handlers };
}

function bindCtx() {
  const notify = vi.fn();
  const setRuntimeApiKey = vi.fn();
  const removeRuntimeApiKey = vi.fn();
  const getApiKey = vi.fn().mockResolvedValue(null);
  const setStatus = vi.fn();
  return {
    notify,
    setRuntimeApiKey,
    removeRuntimeApiKey,
    getApiKey,
    setStatus,
    ctx: {
      model: { provider: "opencode-go" },
      ui: { notify, setStatus },
      modelRegistry: {
        authStorage: { setRuntimeApiKey, removeRuntimeApiKey, getApiKey },
      },
      hasUI: true,
      isIdle: vi.fn().mockReturnValue(true),
      sessionManager: { getSessionId: () => null },
    },
  };
}

function setEnv() {
  vi.stubEnv("OC_GO_API_KEY_1", "key-1");
  vi.stubEnv("OC_GO_API_KEY_2", "key-2");
  vi.stubEnv("OC_GO_WORKSPACE_1", "ws-1");
  vi.stubEnv("OC_GO_WORKSPACE_2", "ws-2");
  vi.stubEnv("OC_GO_COOKIE_1", "ck-1");
  vi.stubEnv("OC_GO_COOKIE_2", "ck-2");
}

function quotaError(provider = "opencode-go") {
  return {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: '429: {"type":"GoUsageLimitError","error":"quota"}',
      provider,
    },
  };
}

function timeoutError(provider = "opencode-go") {
  return {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: "Request timed out.",
      provider,
    },
  };
}

function streamError(provider = "opencode-go") {
  return {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: "Stream ended without finish_reason",
      provider,
    },
  };
}

function streamingFailureError(provider = "opencode-go") {
  return {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: "Streaming response failed",
      provider,
    },
  };
}

function quotaSnapshot(account1: number, account2: number) {
  const source = (name: string, remainingPercent: number) => ({
    identity: {
      providerId: "opencode-go",
      sourceId: `opencode-go:${name}`,
    },
    descriptor: {
      identity: {
        providerId: "opencode-go",
        sourceId: `opencode-go:${name}`,
      },
      displayName: `OpenCode ${name}`,
      compactPrefix: "OpenCode",
      configFingerprint: `f-${name}`,
    },
    state: "fresh" as const,
    observedAt: Date.now(),
    lastSuccessAt: Date.now(),
    windows: {
      rolling: { remainingPercent, resetAt: 1_900_000_000 },
      weekly: { remainingPercent, resetAt: 1_900_000_000 },
      monthly: { remainingPercent, resetAt: 1_900_000_000 },
    },
  });
  return {
    version: 1,
    revision: 2,
    cycle: { cycleStartedAt: Date.now(), lastCompletedAt: Date.now() },
    sources: {
      "opencode-go/opencode-go:1": source("1", account1),
      "opencode-go/opencode-go:2": source("2", account2),
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let handlers: Record<string, Handler>;
let sendUserMessage: MockInstance;
let setRuntimeApiKey: MockInstance;
let notify: MockInstance;
let ctx: ReturnType<typeof bindCtx>["ctx"];

beforeEach(async () => {
  logEvents.length = 0;
  setEnv();
  const mock = createMockPi();
  handlers = mock.handlers;
  sendUserMessage = mock.pi.sendUserMessage as unknown as MockInstance;
  extensionFactory(mock.pi);
  const bound = bindCtx();
  ctx = bound.ctx;
  setRuntimeApiKey = bound.setRuntimeApiKey;
  notify = bound.notify;
  await handlers["session_start"]!({}, ctx);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session_start — source declaration", () => {
  it("declares Codex even when authentication is missing", () => {
    const lifecycle = vi.mocked(createQuotaLifecycle).mock.results[0]?.value;
    expect(lifecycle?.start).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: expect.arrayContaining([
          expect.objectContaining({
            providerId: "openai-codex",
            sourceId: "codex-login",
            credentials: undefined,
          }),
        ]),
      }),
    );
  });

  it("starts quota lifecycle even when no OpenCode runtime API key exists", async () => {
    await handlers["session_shutdown"]!({}, ctx);
    vi.stubEnv("OC_GO_API_KEY_1", "");
    vi.stubEnv("OC_GO_API_KEY_2", "");
    const callsBefore = vi.mocked(createQuotaLifecycle).mock.calls.length;

    await handlers["session_start"]!({}, ctx);

    expect(vi.mocked(createQuotaLifecycle).mock.calls.length).toBe(
      callsBefore + 1,
    );
  });
});

describe("snapshot-driven reselection", () => {
  it("replaces a blind fallback when the first usable snapshot arrives idle", () => {
    const lifecycle = vi.mocked(createQuotaLifecycle).mock.results[0]?.value;
    const onSnapshot = vi.mocked(lifecycle!.onSnapshot).mock.calls[0]![0];

    onSnapshot(quotaSnapshot(20, 80));

    expect(setRuntimeApiKey).toHaveBeenLastCalledWith("opencode-go", "key-2");
  });

  it("defers blind-fallback reselection until agent_settled", () => {
    const lifecycle = vi.mocked(createQuotaLifecycle).mock.results[0]?.value;
    const onSnapshot = vi.mocked(lifecycle!.onSnapshot).mock.calls[0]![0];
    vi.mocked(ctx.isIdle).mockReturnValue(false);

    onSnapshot(quotaSnapshot(20, 80));
    expect(setRuntimeApiKey).toHaveBeenLastCalledWith("opencode-go", "key-1");

    vi.mocked(ctx.isIdle).mockReturnValue(true);
    handlers["agent_settled"]!({}, ctx);
    expect(setRuntimeApiKey).toHaveBeenLastCalledWith("opencode-go", "key-2");
  });

  it("keeps an active usable account stable when another becomes better", () => {
    const lifecycle = vi.mocked(createQuotaLifecycle).mock.results[0]?.value;
    const onSnapshot = vi.mocked(lifecycle!.onSnapshot).mock.calls[0]![0];
    onSnapshot(quotaSnapshot(20, 80));
    const activationCount = setRuntimeApiKey.mock.calls.length;

    const newer = quotaSnapshot(90, 50);
    newer.revision = 3;
    onSnapshot(newer);

    expect(setRuntimeApiKey).toHaveBeenLastCalledWith("opencode-go", "key-2");
    expect(setRuntimeApiKey).toHaveBeenCalledTimes(activationCount);
  });
});

describe("handleMessageEnd — rotation gating", () => {
  it("rotates and queues continue on GoUsageLimitError", async () => {
    await handlers["message_end"]!(quotaError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
    expect(setRuntimeApiKey).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Rotated OpenCode Go"),
      "info",
    );
  });

  it("retries once on timeout errors", async () => {
    await handlers["message_end"]!(timeoutError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
    expect(
      logEvents.some((entry) => entry.event === "streaming_failure_retry"),
    ).toBe(true);
  });

  it("retries once on stream interruption errors", async () => {
    await handlers["message_end"]!(streamError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
    expect(
      logEvents.some((entry) => entry.event === "streaming_failure_retry"),
    ).toBe(true);
  });

  it("ignores errors on non-opencode-go providers", async () => {
    const otherCtx = { ...ctx, model: { provider: "anthropic" } };
    await handlers["message_end"]!(quotaError("anthropic"), otherCtx);

    expect(sendUserMessage).not.toHaveBeenCalled();
  });
});

describe("handleMessageEnd — transient stream retry", () => {
  it("retries once on Streaming response failed", async () => {
    await handlers["message_end"]!(streamingFailureError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
    expect(
      logEvents.some((entry) => entry.event === "streaming_failure_retry"),
    ).toBe(true);
  });

  it("does not rotate on streaming failure", async () => {
    const callsBefore = setRuntimeApiKey.mock.calls.length;
    await handlers["message_end"]!(streamingFailureError(), ctx);

    expect(setRuntimeApiKey).toHaveBeenCalledTimes(callsBefore);
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not retry on second streaming failure in same turn", async () => {
    await handlers["message_end"]!(streamingFailureError(), ctx);
    sendUserMessage.mockClear();

    await handlers["message_end"]!(streamingFailureError(), ctx);

    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(
      logEvents.some((entry) => entry.event === "streaming_failure_skipped"),
    ).toBe(true);
  });

  it("resets streaming failure count on turn_start", async () => {
    await handlers["message_end"]!(streamingFailureError(), ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    handlers["turn_start"]!({}, ctx);
    sendUserMessage.mockClear();

    await handlers["message_end"]!(streamingFailureError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
  });

  it("does not retry if continuation already sent this turn", async () => {
    await handlers["message_end"]!(quotaError(), ctx);
    sendUserMessage.mockClear();

    await handlers["message_end"]!(streamingFailureError(), ctx);

    expect(sendUserMessage).not.toHaveBeenCalled();
  });

  it("ignores streaming failures on non-opencode-go providers", async () => {
    const otherCtx = { ...ctx, model: { provider: "anthropic" } };
    await handlers["message_end"]!(
      streamingFailureError("anthropic"),
      otherCtx,
    );

    expect(sendUserMessage).not.toHaveBeenCalled();
  });
});

describe("handleMessageEnd — processing cycle exhaustion", () => {
  it("stops after every account has been attempted across turns", async () => {
    await handlers["message_end"]!(quotaError(), ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    handlers["turn_start"]!({}, ctx);
    await handlers["message_end"]!(quotaError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining(
        "All OpenCode Go accounts have been attempted during this processing cycle",
      ),
      "warning",
    );
  });
});

describe("handleAgentSettled — processing cycle reset", () => {
  it("allows an account again in a later cycle after its cooldown expires", async () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    await handlers["message_end"]!(quotaError(), ctx);
    handlers["turn_start"]!({}, ctx);
    await handlers["message_end"]!(quotaError(), ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    handlers["agent_settled"]!({}, ctx);
    handlers["turn_start"]!({}, ctx);
    nowSpy.mockReturnValue(now + 61_000);
    await handlers["message_end"]!(quotaError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledTimes(2);
  });
});
