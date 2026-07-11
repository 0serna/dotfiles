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
}));

vi.mock("../opencode.js", () => ({
  fetchOpenCodeGoData: vi.fn().mockResolvedValue({
    monthly: { remainingPercent: 50, resetInSec: 3600 },
    weekly: { remainingPercent: 50, resetInSec: 3600 },
    rolling: { remainingPercent: 50, resetInSec: 3600 },
  }),
}));

vi.mock("../loading.js", () => ({
  withQuotaNotification: vi.fn(async (_ctx: unknown, op: () => unknown) =>
    op(),
  ),
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
  return {
    notify,
    setRuntimeApiKey,
    removeRuntimeApiKey,
    ctx: {
      model: { provider: "opencode-go" },
      ui: { notify },
      modelRegistry: {
        authStorage: { setRuntimeApiKey, removeRuntimeApiKey },
      },
      hasUI: true,
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

  it("does not rotate on timeout errors", async () => {
    await handlers["message_end"]!(timeoutError(), ctx);

    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(logEvents.some((entry) => entry.event === "message_end_error")).toBe(
      false,
    );
  });

  it("does not rotate on stream interruption errors", async () => {
    await handlers["message_end"]!(streamError(), ctx);

    expect(sendUserMessage).not.toHaveBeenCalled();
    expect(logEvents.some((entry) => entry.event === "message_end_error")).toBe(
      false,
    );
  });

  it("ignores errors on non-opencode-go providers", async () => {
    const otherCtx = { ...ctx, model: { provider: "anthropic" } };
    await handlers["message_end"]!(quotaError("anthropic"), otherCtx);

    expect(sendUserMessage).not.toHaveBeenCalled();
  });
});

describe("handleMessageEnd — per-turn cycle exhaustion", () => {
  it("stops and notifies when every account has been attempted this turn", async () => {
    // First rotation: A → B
    await handlers["message_end"]!(quotaError(), ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    // Second quota error on B: only A and B are configured, both have been
    // attempted, so the handler must stop and notify the user.
    await handlers["message_end"]!(quotaError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("All OpenCode Go accounts have been attempted"),
      "warning",
    );
  });
});

describe("handleTurnStart — per-turn reset", () => {
  it("clears triedAccountsThisTurn on turn_start", async () => {
    // First turn: A → B (both added to attempted set)
    await handlers["message_end"]!(quotaError(), ctx);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    // Second quota error should hit the cycle-exhausted branch
    await handlers["message_end"]!(quotaError(), ctx);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("All OpenCode Go accounts have been attempted"),
      "warning",
    );

    // Begin a new turn — the set is reset, so the next quota error rotates again
    handlers["turn_start"]!({}, ctx);
    await handlers["message_end"]!(quotaError(), ctx);

    expect(sendUserMessage).toHaveBeenCalledTimes(2);
  });
});
