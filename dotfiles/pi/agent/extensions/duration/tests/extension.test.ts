import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => void;

function mockCtx(
  setStatus: (key: string, text: string | undefined) => void,
  entries: unknown[] = [],
) {
  return {
    ui: {
      setStatus,
      theme: {
        fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
      },
    },
    sessionManager: { getEntries: () => entries },
  };
}

/**
 * Lightweight mock of ExtensionAPI for testing event-driven behavior.
 */
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

// Import the extension factory after setting up mocks
import extensionFactory from "../index.ts";

describe("duration extension lifecycle", () => {
  it("publishes live elapsed time on agent_start", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    handlers["agent_start"]!({}, mockCtx(setStatus));

    expect(setStatus).toHaveBeenCalledWith(
      "duration",
      expect.stringMatching(/^<dim>⏱ \d+s<\/dim>$/),
    );
  });

  it("starts a one-second interval on agent_start", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    handlers["agent_start"]!({}, mockCtx(setStatus));

    expect(setStatus).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(setStatus).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(setStatus).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("clears interval and leaves the final counter on agent_end", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    const ctx = mockCtx(setStatus);
    handlers["agent_start"]!({}, ctx);
    vi.advanceTimersByTime(3000);

    handlers["agent_end"]!({}, ctx);

    // After agent_end, no more interval ticks
    const callsAfterEnd = setStatus.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(setStatus).toHaveBeenCalledTimes(callsAfterEnd);

    // Last call should keep the live counter format.
    const lastCall = setStatus.mock.calls[setStatus.mock.calls.length - 1]!;
    expect(lastCall[0]).toBe("duration");
    expect(lastCall[1]).toMatch(/^<dim>⏱ \d+s<\/dim>$/);

    vi.useRealTimers();
  });

  it("clears interval on session_shutdown", () => {
    vi.useFakeTimers();
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    handlers["agent_start"]!({}, mockCtx(setStatus));
    vi.advanceTimersByTime(1000);

    handlers["session_shutdown"]!({}, {});

    const callsAfterShutdown = setStatus.mock.calls.length;
    vi.advanceTimersByTime(5000);
    expect(setStatus).toHaveBeenCalledTimes(callsAfterShutdown);

    vi.useRealTimers();
  });

  it("infers and publishes duration on session_start with valid history", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    const entries = [
      {
        type: "message",
        timestamp: "2024-01-01T00:00:00Z",
        message: { role: "user" },
      },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:05Z",
        message: { role: "assistant" },
      },
    ];

    handlers["session_start"]!({}, mockCtx(setStatus, entries));

    expect(setStatus).toHaveBeenCalledWith("duration", "<dim>⏱ 5s</dim>");
  });

  it("publishes nothing on session_start with no inferable history", () => {
    const { pi, handlers } = createMockPi();
    extensionFactory(pi);

    const setStatus = vi.fn();
    handlers["session_start"]!({}, mockCtx(setStatus));

    expect(setStatus).not.toHaveBeenCalled();
  });
});
