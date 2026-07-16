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

vi.mock("../quota-refresh.js", () => ({
  createQuotaRefresh: vi.fn(() => ({
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
    recordExhaustion: vi.fn().mockResolvedValue(undefined),
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
const { createQuotaRefresh } = await import("../quota-refresh.js");

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
    events: { emit: vi.fn() },
    registerCommand: vi.fn(),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
  } as unknown as ExtensionAPI;
  return { pi, handlers };
}

function bindCtx() {
  const notify = vi.fn();
  const getApiKeyForProvider = vi.fn().mockResolvedValue(undefined);
  const setStatus = vi.fn();
  return {
    notify,
    ctx: {
      model: { provider: "opencode-go" },
      ui: {
        notify,
        setStatus,
        theme: { fg: (_intent: string, text: string) => text },
      },
      modelRegistry: { getApiKeyForProvider },
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
let emit: MockInstance;
let registerProvider: MockInstance;
let unregisterProvider: MockInstance;
let notify: MockInstance;
let ctx: ReturnType<typeof bindCtx>["ctx"];

beforeEach(async () => {
  logEvents.length = 0;
  setEnv();
  const mock = createMockPi();
  handlers = mock.handlers;
  sendUserMessage = mock.pi.sendUserMessage as unknown as MockInstance;
  emit = mock.pi.events.emit as unknown as MockInstance;
  extensionFactory(mock.pi);
  const bound = bindCtx();
  ctx = bound.ctx;
  registerProvider = mock.pi.registerProvider as unknown as MockInstance;
  unregisterProvider = mock.pi.unregisterProvider as unknown as MockInstance;
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
    const refresh = vi.mocked(createQuotaRefresh).mock.results[0]?.value;
    expect(refresh?.start).toHaveBeenCalledWith(
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
    expect(unregisterProvider).toHaveBeenCalledWith("opencode-go");
    vi.stubEnv("OC_GO_API_KEY_1", "");
    vi.stubEnv("OC_GO_API_KEY_2", "");
    const callsBefore = vi.mocked(createQuotaRefresh).mock.calls.length;

    await handlers["session_start"]!({}, ctx);

    expect(vi.mocked(createQuotaRefresh).mock.calls.length).toBe(
      callsBefore + 1,
    );
  });
});

describe("snapshot-driven reselection", () => {
  it("replaces a blind fallback when the first usable snapshot arrives idle", () => {
    const refresh = vi.mocked(createQuotaRefresh).mock.results[0]?.value;
    const onSnapshot = vi.mocked(refresh!.onSnapshot).mock.calls[0]![0];

    onSnapshot(quotaSnapshot(20, 80));

    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-2",
    });
  });

  it("defers blind-fallback reselection until agent_settled", () => {
    const refresh = vi.mocked(createQuotaRefresh).mock.results[0]?.value;
    const onSnapshot = vi.mocked(refresh!.onSnapshot).mock.calls[0]![0];
    vi.mocked(ctx.isIdle).mockReturnValue(false);

    onSnapshot(quotaSnapshot(20, 80));
    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-1",
    });

    vi.mocked(ctx.isIdle).mockReturnValue(true);
    handlers["agent_settled"]!({}, ctx);
    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-2",
    });
  });

  it("keeps an active usable account stable when another becomes better", () => {
    const refresh = vi.mocked(createQuotaRefresh).mock.results[0]?.value;
    const onSnapshot = vi.mocked(refresh!.onSnapshot).mock.calls[0]![0];
    onSnapshot(quotaSnapshot(20, 80));
    const activationCount = registerProvider.mock.calls.length;

    const newer = quotaSnapshot(90, 50);
    newer.revision = 3;
    onSnapshot(newer);

    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-2",
    });
    expect(registerProvider).toHaveBeenCalledTimes(activationCount);
  });
});

describe("handleMessageEnd — rotation gating", () => {
  it("rotates and requests centralized continuation on GoUsageLimitError", async () => {
    await handlers["message_end"]!(quotaError(), ctx);

    expect(emit).toHaveBeenCalledWith("auto-continue:request", {
      reason: "quota-rotation",
      origin: { provider: "opencode-go" },
    });
    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(registerProvider).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Rotated OpenCode Go"),
      "info",
    );
  });

  it("ignores timeout errors", async () => {
    const activationsBefore = registerProvider.mock.calls.length;
    await handlers["message_end"]!(timeoutError(), ctx);

    expect(registerProvider).toHaveBeenCalledTimes(activationsBefore);
    expect(emit).not.toHaveBeenCalled();
  });

  it("ignores stream interruption errors", async () => {
    const activationsBefore = registerProvider.mock.calls.length;
    await handlers["message_end"]!(streamError(), ctx);

    expect(registerProvider).toHaveBeenCalledTimes(activationsBefore);
    expect(emit).not.toHaveBeenCalled();
  });

  it("ignores errors on non-opencode-go providers", async () => {
    const otherCtx = { ...ctx, model: { provider: "anthropic" } };
    await handlers["message_end"]!(quotaError("anthropic"), otherCtx);

    expect(emit).not.toHaveBeenCalled();
    expect(sendUserMessage).not.toHaveBeenCalled();
  });
});

describe("handleMessageEnd — processing cycle exhaustion", () => {
  it("stops after every account has been attempted across turns", async () => {
    await handlers["message_end"]!(quotaError(), ctx);
    expect(emit).toHaveBeenCalledTimes(1);

    handlers["turn_start"]!({}, ctx);
    await handlers["message_end"]!(quotaError(), ctx);

    expect(emit).toHaveBeenCalledTimes(1);
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
    expect(emit).toHaveBeenCalledTimes(1);

    handlers["agent_settled"]!({}, ctx);
    handlers["turn_start"]!({}, ctx);
    nowSpy.mockReturnValue(now + 61_000);
    await handlers["message_end"]!(quotaError(), ctx);

    expect(emit).toHaveBeenCalledTimes(2);
  });
});
