import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEvents: Array<{ event: string; data?: Record<string, unknown> }> = [];
vi.mock("../../shared/logger.js", () => ({
  createExtensionLogger: vi.fn().mockReturnValue({
    log(event: string, data?: Record<string, unknown>) {
      logEvents.push({ event, data });
    },
  }),
}));

const extensionFactory = (await import("../index.js")).default;

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

function createHarness() {
  const handlers: Record<string, Handler> = {};
  const eventHandlers: Record<string, (data: unknown) => void> = {};
  const sendUserMessage = vi.fn();
  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
    events: {
      on(event: string, handler: (data: unknown) => void) {
        eventHandlers[event] = handler;
      },
    },
    sendUserMessage,
  } as unknown as ExtensionAPI;
  extensionFactory(pi);

  const isIdle = vi.fn().mockReturnValue(true);
  const hasPendingMessages = vi.fn().mockReturnValue(false);
  const notify = vi.fn();
  const ctx = {
    model: { provider: "openai-codex", id: "codex-before" },
    isIdle,
    hasPendingMessages,
    sessionManager: { getSessionId: () => "session-1" },
    ui: { notify },
  };

  return {
    handlers,
    eventHandlers,
    sendUserMessage,
    isIdle,
    hasPendingMessages,
    notify,
    ctx,
  };
}

const transientError = {
  message: {
    role: "assistant",
    stopReason: "error",
    errorMessage: "transport: fetch failed",
    provider: "openai-codex",
    model: "codex-before",
  },
};

describe("auto-continue lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logEvents.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("waits for agent_settled and a one-second quiet period", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(harness.sendUserMessage).not.toHaveBeenCalled();

    await harness.handlers.agent_settled!({}, harness.ctx);
    await vi.advanceTimersByTimeAsync(999);
    expect(harness.sendUserMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
  });

  it("uses the response configuration active at dispatch", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);

    harness.ctx.model = {
      provider: "anthropic",
      id: "claude-at-dispatch",
    };
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(
      logEvents.find((entry) => entry.event === "sent")?.data,
    ).toMatchObject({
      originProvider: "openai-codex",
      originModel: "codex-before",
      dispatchProvider: "anthropic",
      dispatchModel: "claude-at-dispatch",
    });
  });

  it("cancels recovery when user activity starts", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);

    await harness.handlers.input!(
      { text: "new work", source: "interactive" },
      harness.ctx,
    );
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.sendUserMessage).not.toHaveBeenCalled();
  });

  it("cancels recovery when a pending message exists at expiry", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);
    harness.hasPendingMessages.mockReturnValue(true);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.sendUserMessage).not.toHaveBeenCalled();
  });

  it("cleans up a pending timer during session shutdown", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);

    await harness.handlers.session_shutdown!({}, harness.ctx);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.sendUserMessage).not.toHaveBeenCalled();
  });

  it("dispatches a typed quota request immediately", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);

    harness.eventHandlers["auto-continue:request"]!({
      reason: "quota-rotation",
      origin: { provider: "opencode-go", model: "go-model" },
    });

    expect(harness.sendUserMessage).toHaveBeenCalledWith("continue", {
      deliverAs: "followUp",
    });
  });

  it("suppresses unsupported request payloads", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);

    harness.eventHandlers["auto-continue:request"]!({
      reason: "caller-defined",
      delayMs: 50,
    });

    expect(harness.sendUserMessage).not.toHaveBeenCalled();
  });

  it("coalesces concurrent quota requests", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    const request = { reason: "quota-rotation" };

    harness.eventHandlers["auto-continue:request"]!(request);
    harness.eventHandlers["auto-continue:request"]!(request);

    expect(harness.sendUserMessage).toHaveBeenCalledTimes(1);
  });

  it("lets quota precedence cancel a pending transient timer", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);

    harness.eventHandlers["auto-continue:request"]!({
      reason: "quota-rotation",
    });
    expect(harness.sendUserMessage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sendUserMessage).toHaveBeenCalledTimes(1);
  });

  it("logs decisions without complete provider errors or recovery notifications", async () => {
    const harness = createHarness();
    await harness.handlers.session_start!({}, harness.ctx);
    await harness.handlers.message_end!(transientError, harness.ctx);
    await harness.handlers.agent_settled!({}, harness.ctx);
    await harness.handlers.input!(
      { text: "new work", source: "interactive" },
      harness.ctx,
    );
    harness.eventHandlers["auto-continue:request"]!({
      reason: "quota-rotation",
    });
    harness.eventHandlers["auto-continue:request"]!({ reason: "invalid" });

    expect(logEvents.map((entry) => entry.event)).toEqual(
      expect.arrayContaining([
        "requested",
        "scheduled",
        "cancelled",
        "sent",
        "suppressed",
      ]),
    );
    expect(JSON.stringify(logEvents)).not.toContain("transport: fetch failed");
    expect(harness.notify).not.toHaveBeenCalled();
  });
});
