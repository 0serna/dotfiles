import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
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

describe("working-time extension lifecycle", () => {
  it("sets the live elapsed time when the agent starts", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    expect(ctx.ui.setWorkingIndicator).toHaveBeenCalledWith({
      frames: ["<accent>▸</accent>"],
    });
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledWith(
      "<muted>Working 0s</muted>",
    );
  });

  it("updates the working time every second", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("notifies the final elapsed time when the agent ends", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(3000);

    handlers["agent_end"]!({}, ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith("Completed in 3s", "info");
    expect(ctx.ui.setWorkingMessage).toHaveBeenLastCalledWith();

    vi.useRealTimers();
  });

  it("stops updating after agent_end", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const ctx = mockCtx();
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(1000);
    handlers["agent_end"]!({}, ctx);

    const callsAfterEnd = ctx.ui.setWorkingMessage.mock.calls.length;
    vi.advanceTimersByTime(5000);

    expect(ctx.ui.setWorkingMessage).toHaveBeenCalledTimes(callsAfterEnd);

    vi.useRealTimers();
  });

  it("clears the timer and restores the default message on shutdown", () => {
    vi.useFakeTimers();
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

    vi.useRealTimers();
  });
});
