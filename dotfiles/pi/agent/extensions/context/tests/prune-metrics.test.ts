import { describe, expect, it, vi } from "vitest";
import { pruneMessages } from "../prune.ts";
import {
  assistantToolCall,
  big,
  dcpTail,
  textOf,
  toolResult,
} from "./prune.test-utils.ts";

describe("context DCP pruning metrics", () => {
  it("reports positive savings for applied stubs", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
    expect(log.mock.calls[0]?.[1]?.["estimatedSavedTokens"]).toBeGreaterThan(0);
  });

  it("fails open when logging throws", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: {
        log: () => {
          throw new Error("boom");
        },
      },
    });

    expect(pruned).not.toBe(messages);
    expect(textOf(pruned[1]!)).toBe(big());
  });

  it("does not mutate user messages, assistant messages, or original messages", () => {
    const user = { role: "user", content: "keep me" };
    const assistant = assistantToolCall("a", "bash", { command: "rg foo" });
    const result = toolResult("a", "bash", big());
    const messages = [user, assistant, result, ...dcpTail()];

    const { messages: pruned } = pruneMessages(messages);

    expect(pruned[0]!).toBe(user);
    expect(pruned[1]!).toBe(assistant);
    expect(textOf(result)).toBe(big());
    expect(textOf(pruned[2]!)).toContain("reason=stale_large");
  });

  it("logs summary metrics without full original output", () => {
    const log = vi.fn();
    const secret = `secret-${big()}`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", secret),
      ...dcpTail(),
    ];

    const { metrics } = pruneMessages(messages, {
      logger: { log },
      contextSequence: 7,
    });

    const payload = log.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toBe("context_pruned");
    expect(JSON.stringify(payload)).not.toContain(secret);
    expect(payload).toMatchObject({
      contextSequence: 7,
      processedCount: 32,
      stubbedCount: 1,
      reasonCounts: {
        superseded: 0,
        stale_large: 1,
      },
    });
    expect(metrics).toStrictEqual(payload);
    expect(payload.estimatedSavedTokens).toEqual(expect.any(Number));
    expect(payload.estimatedSavedTokens).toBeGreaterThan(0);
    expect(payload.estimatedSavedTokensByReason).toMatchObject({
      stale_large: payload.estimatedSavedTokens,
    });
    expect(payload.estimatedSavedTokensByTool).toMatchObject({
      bash: payload.estimatedSavedTokens,
    });
  });

  it("logs baseline metrics when nothing is pruned", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "unique output"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: { log },
      contextSequence: 1,
    });

    expect(textOf(pruned[1]!)).toBe("unique output");
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      contextSequence: 1,
      processedCount: 32,
      stubbedCount: 0,
      estimatedSavedTokens: 0,
      estimatedSavedTokensByTool: {},
    });
  });
});
