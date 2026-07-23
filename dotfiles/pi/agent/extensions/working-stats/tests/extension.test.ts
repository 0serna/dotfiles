import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import extensionFactory from "../index.ts";

type Handler = (...args: unknown[]) => void;

function mockCtx() {
  return {
    model: { id: "gpt-5" },
    sessionManager: { getSessionId: () => "test-session" },
    isIdle: vi.fn(() => true),
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

function createMockPi(initialThinkingLevel: string = "off"): {
  pi: ExtensionAPI;
  handlers: Record<string, Handler>;
  setThinkingLevel: (level: string) => void;
} {
  const handlers: Record<string, Handler> = {};
  let thinkingLevel = initialThinkingLevel;

  const pi = {
    on(event: string, handler: Handler) {
      handlers[event] = handler;
    },
    getThinkingLevel: () => thinkingLevel,
  } as unknown as ExtensionAPI;

  return {
    pi,
    handlers,
    setThinkingLevel: (level) => {
      thinkingLevel = level;
    },
  };
}

function textDelta(delta: string, model = "gpt-5", responseModel?: string) {
  return {
    message: { role: "assistant", usage: {} },
    assistantMessageEvent: {
      type: "text_delta",
      contentIndex: 0,
      delta,
      partial: {
        model,
        ...(responseModel !== undefined ? { responseModel } : {}),
      },
    },
  };
}

function messageEnd(outputTokens?: number, model = "gpt-5") {
  return {
    message: {
      role: "assistant",
      model,
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
      frames: ["◐", "◓", "◑", "◒"].map((f) => `<accent>${f}</accent>`),
      intervalMs: 120,
    });
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledWith(
      "<muted> gpt-5 · 0:00 · idle 0:00</muted>",
    );
  });

  it("includes thinking level in label when not off", () => {
    const { pi, handlers } = createMockPi("high");
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledWith(
      "<muted> gpt-5/high · 0:00 · idle 0:00</muted>",
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

  it("measures repeated agent attempts as one processing cycle until settled idle", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(3000);

    expect(handlers["agent_end"]).toBeUndefined();
    expect(ctx.ui.notify).not.toHaveBeenCalled();

    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(2000);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledOnce();
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5 · 0:05 · idle 0:05</muted>",
      "info",
    );
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith();
  });

  it("includes the final throughput in the completion notification when available", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200), ctx);
    vi.advanceTimersByTime(1000);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5 · 0:02 · 200 tps</muted>",
      "info",
    );
  });

  it("includes thinking level in completion notification when not off", () => {
    const { pi, handlers } = createMockPi("high");
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200), ctx);
    vi.advanceTimersByTime(1000);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5/high · 0:02 · 200 tps</muted>",
      "info",
    );
  });

  it("stops updating after settled idle", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(1000);
    handlers["agent_settled"]!({}, ctx);

    const callsAfterEnd = ctx.ui.setWorkingMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(callsAfterEnd);
  });

  it("defers completion when settled handlers have already started more work", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(1000);

    ctx.isIdle.mockReturnValue(false);
    handlers["agent_settled"]!({}, ctx);
    expect(ctx.ui.notify).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    ctx.isIdle.mockReturnValue(true);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5 · 0:02 · idle 0:02</muted>",
      "info",
    );
  });

  it("clears the timer without notifying on shutdown", () => {
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
    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });
});

describe("working-stats extension throughput integration", () => {
  it("shows live throughput on the first interval tick after streaming starts", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);

    vi.advanceTimersByTime(499);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:00 · idle 0:00</muted>",
    );

    vi.advanceTimersByTime(501);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:01 · 100 tps</muted>",
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
      "<muted> gpt-5 · 0:02 · idle 0:02</muted>",
    );
  });

  it("shows total elapsed time instead of idle time before the first stream ends", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(2000);

    // First delta arrives (sets firstDeltaMs) but no message_end yet (streamEndTime is null)
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);

    // Should still show total elapsed time, not a giant idle duration from Date.now() - null
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:03 · 100 tps</muted>",
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
      "<muted> gpt-5 · 0:02 · idle 0:01</muted>",
    );
  });

  it("shows the placeholder during tool execution between streams", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);

    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:02 · idle 0:01</muted>",
    );

    vi.advanceTimersByTime(5000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:07 · idle 0:06</muted>",
    );
  });

  it("starts a fresh measurement when a new stream begins", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);

    handlers["message_update"]!(textDelta("x".repeat(4000)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(1000), ctx);
    vi.advanceTimersByTime(1000);

    handlers["message_update"]!(textDelta("hi"), ctx);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:03 · 1 tps</muted>",
    );
  });

  it("shows the thinking level active when each stream begins", () => {
    const { pi, handlers, setThinkingLevel } = createMockPi("high");
    extensionFactory(pi);
    const ctx = mockCtx();
    ctx.model.id = "mimo-v2.5-pro";

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(
      textDelta("x".repeat(400), "mimo-v2.5-pro"),
      ctx,
    );
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100, "mimo-v2.5-pro"), ctx);

    setThinkingLevel("medium");
    handlers["message_update"]!(textDelta("x".repeat(400), "gpt-5.6-sol"), ctx);
    vi.advanceTimersByTime(1000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5.6-sol/medium · 0:02 · 100 tps</muted>",
    );
  });

  it("updates model from streaming partial", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(
      textDelta("x".repeat(100), "requested-model", "actual-model"),
      ctx,
    );
    vi.advanceTimersByTime(1000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("actual-model"),
    );
  });

  it("attributes an empty response to its model and thinking level", () => {
    const { pi, handlers, setThinkingLevel } = createMockPi("high");
    extensionFactory(pi);
    const ctx = mockCtx();
    ctx.model.id = "mimo-v2.5-pro";

    handlers["agent_start"]!({}, ctx);
    handlers["turn_start"]!({}, ctx);
    handlers["message_update"]!(
      textDelta("x".repeat(400), "mimo-v2.5-pro"),
      ctx,
    );
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100, "mimo-v2.5-pro"), ctx);

    setThinkingLevel("medium");
    handlers["turn_start"]!({}, ctx);
    handlers["message_end"]!(messageEnd(undefined, "gpt-5.6-sol"), ctx);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5.6-sol/medium · 0:01 · 100 tps</muted>",
      "info",
    );
  });

  it("preserves the latest valid final throughput across later attempts without usage", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(textDelta("x".repeat(400)), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);

    handlers["agent_start"]!({}, ctx);
    handlers["message_end"]!(messageEnd(undefined), ctx);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5 · 0:01 · 100 tps</muted>",
      "info",
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

    handlers["agent_start"]!({}, ctx);
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> gpt-5 · 0:00 · idle 0:00</muted>",
    );
  });
});

describe("working-stats extension model changes", () => {
  it("updates model from streaming partial during run", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(2000);

    handlers["message_update"]!(
      textDelta("x".repeat(100), "claude-opus-4-5"),
      ctx,
    );
    vi.advanceTimersByTime(1000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith(
      "<muted> claude-opus-4-5 · 0:03 · 25 tps</muted>",
    );
  });

  it("falls back to the initial model when no assistant response exists", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> gpt-5 · 0:00 · idle 0:00</muted>",
      "info",
    );
  });

  it("attributes completion to the last responding model from streaming", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(
      textDelta("x".repeat(400), "routed-model"),
      ctx,
    );
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200, "routed-model"), ctx);

    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "<accent>✓</accent> <muted> routed-model · 0:01 · 200 tps</muted>",
      "info",
    );
  });

  it("prefers responseModel over model in completion notification", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["agent_start"]!({}, ctx);
    handlers["message_update"]!(
      textDelta("x".repeat(400), "requested-model", "actual-model"),
      ctx,
    );
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(200, "requested-model"), ctx);

    handlers["agent_settled"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      expect.stringContaining("actual-model"),
      "info",
    );
  });
});
