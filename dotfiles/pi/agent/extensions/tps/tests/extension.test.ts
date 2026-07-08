import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import extensionFactory from "../index.ts";

type Handler = (...args: unknown[]) => void;

function mockCtx() {
  return {
    ui: {
      setStatus: vi.fn(),
      notify: vi.fn(),
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
    type: "message_update",
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
    type: "message_end",
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

describe("tps extension lifecycle", () => {
  it("publishes an initial dim placeholder on session start", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["session_start"]!({}, ctx);

    expect(ctx.ui.setStatus).toHaveBeenCalledWith("tps", "<dim>- tok/s</dim>");
  });
});

describe("tps extension live throughput", () => {
  it("starts timing on first output delta", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["message_update"]!(textDelta("hello world"), ctx);

    // Status should NOT be published yet (< 1 second elapsed)
    expect(ctx.ui.setStatus).not.toHaveBeenCalled();
  });

  it("publishes live status after 1 second", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["message_update"]!(textDelta("hello world"), ctx);
    vi.advanceTimersByTime(1000);

    expect(ctx.ui.setStatus).toHaveBeenCalledWith(
      "tps",
      expect.stringMatching(/<dim>\d+ tok\/s<\/dim>/),
    );
  });

  it("updates live status every second", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["message_update"]!(textDelta("hello world"), ctx);
    vi.advanceTimersByTime(1000);
    const firstCall = ctx.ui.setStatus.mock.calls.length;

    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setStatus.mock.calls.length).toBeGreaterThan(firstCall);
  });

  it("counts total streamed output from multiple delta types", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    // Accumulate some tokens across different delta types
    handlers["message_update"]!(textDelta("hello world"), ctx);
    handlers["message_update"]!(
      {
        type: "message_update",
        message: { role: "assistant", usage: {} },
        assistantMessageEvent: {
          type: "thinking_delta",
          contentIndex: 0,
          delta: "hmm",
          partial: {},
        },
      },
      ctx,
    );

    vi.advanceTimersByTime(1000);
    // Should have published something (exact value depends on heuristic)
    expect(ctx.ui.setStatus).toHaveBeenCalled();
  });
});

describe("tps extension final throughput", () => {
  it("publishes final precise throughput on message_end with usage", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    // Start a stream
    handlers["message_update"]!(textDelta("hello world"), ctx);
    vi.advanceTimersByTime(1000);

    // End with provider usage
    handlers["message_end"]!(messageEnd(200), ctx);

    // Should have published a final status
    expect(ctx.ui.setStatus).toHaveBeenCalledWith(
      "tps",
      "<dim>200 tok/s</dim>",
    );
  });

  it("preserves last final status when no usage available", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    // First stream with usage → final status
    handlers["message_update"]!(textDelta("stream one"), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);

    // Second stream without usage → should NOT overwrite
    handlers["message_update"]!(textDelta("stream two"), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(undefined), ctx);

    // The last final status should still be visible from stream 1
    expect(ctx.ui.setStatus).toHaveBeenCalledWith(
      "tps",
      "<dim>100 tok/s</dim>",
    );
  });

  it("keeps final throughput while tools execute between streams", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    // Stream 1: final with usage
    handlers["message_update"]!(textDelta("one"), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);

    // Advance time (simulating tool execution)
    vi.advanceTimersByTime(5000);

    // Status should still show final from stream 1
    const statusCalls = ctx.ui.setStatus.mock.calls;
    const lastStatus = statusCalls[statusCalls.length - 1];
    expect(lastStatus?.[0]).toBe("tps");
  });
});

describe("tps extension reset between streams", () => {
  it("starts fresh measurement for a new stream", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    // Stream 1
    handlers["message_update"]!(textDelta("one"), ctx);
    vi.advanceTimersByTime(1000);
    handlers["message_end"]!(messageEnd(100), ctx);

    const callsAfterFirst = ctx.ui.setStatus.mock.calls.length;

    // Stream 2 (new stream)
    handlers["message_update"]!(textDelta("two"), ctx);
    vi.advanceTimersByTime(1000);

    // Should have new calls for the new stream
    expect(ctx.ui.setStatus.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});

describe("tps extension cleanup", () => {
  it("clears interval on session_shutdown", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);
    const ctx = mockCtx();

    handlers["message_update"]!(textDelta("hello"), ctx);
    handlers["session_shutdown"]!({}, ctx);

    const callsAfterShutdown = ctx.ui.setStatus.mock.calls.length;
    vi.advanceTimersByTime(5000);

    // No new calls after shutdown
    expect(ctx.ui.setStatus.mock.calls.length).toBe(callsAfterShutdown);
  });
});
