import { describe, expect, it, vi } from "vitest";
import { emptyDcpMetrics } from "../format.ts";
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
      getBranch: () => [
        {
          type: "message",
          message: {
            role: "assistant",
            usage: { input: 100, cacheRead: 900 },
          },
        },
      ],
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
  it("logs displayed context usage in cache status events", () => {
    const logger: StatusLogger = { log: vi.fn() };

    computeAndPublishStatus(createContext(), logger, emptyDcpMetrics(), true);

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
