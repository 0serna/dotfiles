import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import extensionFactory from "../index.ts";

type Handler = (...args: unknown[]) => void;

function mockCtx() {
  return {
    ui: {
      notify: vi.fn(),
      setWorkingIndicator: vi.fn(),
      setWorkingMessage: vi.fn(),
      theme: {
        fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
      },
    },
  };
}

function createMockPi(): {
  pi: ExtensionAPI;
  handlers: Record<string, Handler>;
} {
  const handlers: Record<string, Handler> = {};

  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
  } as unknown as ExtensionAPI;

  return { pi, handlers };
}

function textDelta(delta: string) {
  return {
    message: { role: "assistant", usage: {} },
    assistantMessageEvent: {
      type: "text_delta",
      contentIndex: 0,
      delta,
      partial: {},
    },
  };
}

function messageEnd(outputTokens?: number) {
  return {
    message: {
      role: "assistant",
      usage: outputTokens !== undefined ? { output: outputTokens } : {},
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("working-stats extension lifecycle", () => {
  it("publishes a working message with the elapsed time and throughput placeholder on agent_start", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    expect(ctx.ui.setWorkingIndicator).toHaveBeenCalledWith({
      frames: [
        "<accent>⠋</accent>",
        "<accent>⠙</accent>",
        "<accent>⠹</accent>",
        "<accent>⠸</accent>",
        "<accent>⠼</accent>",
        "<accent>⠴</accent>",
        "<accent>⠦</accent>",
        "<accent>⠧</accent>",
        "<accent>⠇</accent>",
        "<accent>⠏</accent>",
      ],
      intervalMs: 80,
    });
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledWith(
      "<muted>Working 0s | - tok/s</muted>",
    );
  });

  it("updates the working message every second", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(3);
  });

  it("notifies the final elapsed time when the agent ends", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(3000);

    handlers["agent_end"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith("Completed in 3s", "info");
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith();
  });

  it("includes the final throughput in the completion notification when available", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    // Simulate a full stream
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200), ctx);

    // Let the interval tick to render the final display
    vi.advanceTimersByTime(1000);

    // End the agent run
    handlers["agent_end"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "Completed in 2s | 200 tok/s",
      "info",
    );
  });

  it("stops updating after agent_end", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(1000);
    handlers["agent_end"]!({}, ctx);

    const callsAfterEnd = ctx.ui.setWorkingMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(callsAfterEnd);
  });

  it("clears the timer and restores the default message on shutdown", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(1000);
    handlers["session_shutdown"]!({}, ctx);

    const callsAfterShutdown = ctx.ui.setWorkingMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(callsAfterShutdown);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith();
  });
});

describe("working-stats extension throughput integration", () => {
  it("shows live throughput on the first interval tick after streaming starts", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);

    // Before the interval ticks again the placeholder remains
    vi.advanceTimersByTime(500);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 0s | - tok/s</muted>",
    );

    // On the next tick the live throughput appears
    vi.advanceTimersByTime(500);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 1s | 100 tok/s</muted>",
    );
  });

  it("ignores message_update events for non-assistant messages", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(
      {
        message: { role: "user" },
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: "ignored",
          partial: {},
        },
      },
      ctx,
    );

    vi.advanceTimersByTime(2000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 2s | - tok/s</muted>",
    );
  });

  it("shows the placeholder after a stream ends", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200), ctx);

    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 2s | - tok/s</muted>",
    );
  });

  it("shows the placeholder during tool execution between streams", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);

    // Stream 1 with usage
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 2s | - tok/s</muted>",
    );

    // Simulate tool execution: long idle interval
    vi.advanceTimersByTime(5000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 7s | - tok/s</muted>",
    );
  });

  it("starts a fresh measurement when a new stream begins", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);

    // Stream 1: large throughput
    handlers["message_update"]!(textDelta("x".repeat(4000)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(1000), ctx);
    vi.advanceTimersByTime(1000);

    // Stream 2: small throughput
    handlers["message_update"]!(textDelta("hi"), ctx);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 3s | 1 tok/s</muted>",
    );
  });

  it("clears the throughput state on session_shutdown", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);
    handlers["session_shutdown"]!({}, ctx);

    // After shutdown a new agent run should start with the placeholder
    handlers["agent_start"]!({}, ctx);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted>Working 0s | - tok/s</muted>",
    );
  });
});
