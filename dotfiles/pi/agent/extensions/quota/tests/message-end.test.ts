import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { QuotaSnapshot } from "../snapshot.js";

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

vi.mock("../quota-refresh.js", () => ({ createQuotaRefresh: vi.fn() }));

const logEvents: Array<{ event: string; data?: Record<string, unknown> }> = [];
vi.mock("../../shared/logger.js", () => ({
  createExtensionLogger: vi.fn().mockReturnValue({
    log(event: string, data?: Record<string, unknown>) {
      logEvents.push({ event, data });
    },
  }),
}));

const extensionFactory = (await import("../index.ts")).default;
const { createQuotaRefresh } = await import("../quota-refresh.js");

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

function createMockPi() {
  const handlers: Record<string, Handler> = {};
  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
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
  const model = { provider: "opencode-go", id: "mimo-v2.5-pro" };
  return {
    notify,
    ctx: {
      model,
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
    state: remainingPercent === 0 ? ("exhausted" as const) : ("fresh" as const),
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

function createRefresh(snapshot: QuotaSnapshot) {
  return {
    onSnapshot: vi.fn(),
    onStatus: vi.fn(),
    setActiveSource: vi.fn(),
    read: vi.fn().mockResolvedValue(snapshot),
    start: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

let handlers: Record<string, Handler>;
let emit: MockInstance;
let registerProvider: MockInstance;
let unregisterProvider: MockInstance;
let notify: MockInstance;
let ctx: ReturnType<typeof bindCtx>["ctx"];
let refresh: ReturnType<typeof createRefresh>;

async function start(snapshot: QuotaSnapshot = quotaSnapshot(90, 80)) {
  refresh = createRefresh(snapshot);
  vi.mocked(createQuotaRefresh).mockReturnValue(refresh as never);
  const mock = createMockPi();
  handlers = mock.handlers;
  extensionFactory(mock.pi);
  const bound = bindCtx();
  ctx = bound.ctx;
  emit = mock.pi.events.emit as unknown as MockInstance;
  registerProvider = mock.pi.registerProvider as unknown as MockInstance;
  unregisterProvider = mock.pi.unregisterProvider as unknown as MockInstance;
  notify = bound.notify;
  await handlers["session_start"]!({}, ctx);
}

beforeEach(async () => {
  logEvents.length = 0;
  vi.clearAllMocks();
  setEnv();
  await start();
});

describe("session start", () => {
  it("declares Codex even when authentication is missing", () => {
    expect(refresh.start).toHaveBeenCalledWith(
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

  it("activates the best account", () => {
    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-1",
    });
  });

  it("does not replace the OpenCode credential without a selectable snapshot", async () => {
    await handlers["session_shutdown"]!({}, ctx);
    await start({
      version: 1,
      revision: 1,
      cycle: { cycleStartedAt: 0 },
      sources: {},
    });

    expect(registerProvider).not.toHaveBeenCalled();
  });

  it("does not select an account from a later refresh", async () => {
    await handlers["session_shutdown"]!({}, ctx);
    await start({
      version: 1,
      revision: 1,
      cycle: { cycleStartedAt: 0 },
      sources: {},
    });
    const onSnapshot = vi.mocked(refresh.onSnapshot).mock.calls[0]![0];

    onSnapshot(quotaSnapshot(20, 80));

    expect(registerProvider).not.toHaveBeenCalled();
  });
});

describe("request authentication", () => {
  it("overrides a stored credential with the active account key", async () => {
    const headers: Record<string, string | null> = {
      authorization: "Bearer stored-key",
      "x-opencode-client": "pi",
    };

    await handlers["before_provider_headers"]!({ headers }, ctx);

    expect(headers).toEqual({
      Authorization: "Bearer key-1",
      "x-opencode-client": "pi",
    });
    expect(logEvents).toContainEqual({
      event: "request_auth_applied",
      data: { provider: "opencode-go", account: "1" },
    });
  });

  it("does not modify requests for another provider", async () => {
    const headers: Record<string, string | null> = {
      Authorization: "Bearer other-key",
    };
    const otherCtx = { ...ctx, model: { provider: "anthropic", id: "claude" } };

    await handlers["before_provider_headers"]!({ headers }, otherCtx);

    expect(headers.Authorization).toBe("Bearer other-key");
  });

  it("does not override credentials without a selected account", async () => {
    await handlers["session_shutdown"]!({}, ctx);
    await start({
      version: 1,
      revision: 1,
      cycle: { cycleStartedAt: 0 },
      sources: {},
    });
    const headers: Record<string, string | null> = {
      Authorization: "Bearer stored-key",
    };

    await handlers["before_provider_headers"]!({ headers }, ctx);

    expect(headers.Authorization).toBe("Bearer stored-key");
  });
});

describe("runtime rotation", () => {
  it("rotates to the best eligible account and requests continuation", async () => {
    await handlers["message_end"]!(quotaError(), ctx);

    expect(registerProvider).toHaveBeenLastCalledWith("opencode-go", {
      apiKey: "key-2",
    });
    const headers: Record<string, string | null> = {
      Authorization: "Bearer stored-key",
    };
    await handlers["before_provider_headers"]!({ headers }, ctx);
    expect(headers.Authorization).toBe("Bearer key-2");
    expect(emit).toHaveBeenCalledWith("auto-continue:request", {
      reason: "quota-rotation",
      origin: { provider: "opencode-go" },
    });
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Rotated OpenCode Go"),
      "info",
    );
    expect(logEvents.some(({ event }) => event === "rotate_success")).toBe(
      true,
    );
  });

  it("does not mutate the shared quota snapshot after a runtime rejection", async () => {
    await handlers["message_end"]!(quotaError(), ctx);

    expect(refresh).not.toHaveProperty("recordExhaustion");
  });

  it("skips known exhausted accounts and does not continue without a candidate", async () => {
    const onSnapshot = vi.mocked(refresh.onSnapshot).mock.calls[0]![0];
    onSnapshot(quotaSnapshot(90, 0));

    await handlers["message_end"]!(quotaError(), ctx);

    expect(emit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("No eligible OpenCode Go account"),
      "warning",
    );
  });

  it("ignores runtime errors from other providers", async () => {
    const otherCtx = { ...ctx, model: { provider: "anthropic" } };
    await handlers["message_end"]!(quotaError("anthropic"), otherCtx);

    expect(emit).not.toHaveBeenCalled();
  });

  it("clears the provider override on shutdown", async () => {
    await handlers["session_shutdown"]!({}, ctx);

    expect(unregisterProvider).toHaveBeenCalledWith("opencode-go");
  });
});
