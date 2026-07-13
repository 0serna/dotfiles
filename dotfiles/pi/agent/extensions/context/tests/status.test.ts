import { describe, expect, it, vi } from "vitest";
import { computeAndPublishStatus } from "../status.ts";

type StatusContext = Parameters<typeof computeAndPublishStatus>[0];
type StatusLogger = Parameters<typeof computeAndPublishStatus>[1];

function createContext(): StatusContext {
  return {
    getContextUsage: () => ({
      tokens: 12_345,
      contextWindow: 200_000,
      percent: 6.2,
    }),
    sessionManager: {
      getBranch: vi.fn().mockReturnValue([
        {
          type: "message",
          message: {
            role: "assistant",
            usage: { input: 100, cacheRead: 900 },
          },
        },
      ]),
    },
    ui: {
      theme: {
        fg: (_color: string, text: string) => text,
      },
      setStatus: vi.fn(),
    },
  } as unknown as StatusContext;
}

describe("computeAndPublishStatus", () => {
  it("publishes only context tokens in the status", () => {
    const ctx = createContext();

    computeAndPublishStatus(ctx, { log: vi.fn() });

    expect(ctx.ui.setStatus).toHaveBeenCalledWith("context", "12k");
    expect(ctx.sessionManager.getBranch).not.toHaveBeenCalled();
  });

  it("logs cache status when shouldLog is true", () => {
    const ctx = createContext();
    const logger: StatusLogger = { log: vi.fn() };

    computeAndPublishStatus(ctx, logger, true);

    expect(ctx.ui.setStatus).toHaveBeenCalledWith("context", "12k");
    expect(ctx.sessionManager.getBranch).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "cache_status",
      expect.objectContaining({
        hitRate: 90,
        input: 100,
        cacheRead: 900,
        reason: null,
        contextTokens: 12_345,
        contextWindow: 200_000,
        missedCost: 0,
        modelSwitched: false,
        previousModel: null,
        idleMs: 0,
        belowThresholdStreak: 0,
      }),
    );
  });
});
