import { describe, expect, it, vi } from "vitest";
import { pruneMessages } from "../prune.ts";
import {
  assistantToolCall,
  big,
  dcpTail,
  parallelToolCall,
  textOf,
  toolResult,
} from "./prune.test-utils.ts";

describe("context DCP pruning policy", () => {
  it("ignores question results entirely", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "question", {
        question: "first?",
        options: [{ label: "Yes" }],
      }),
      toolResult("a", "question", big()),
      assistantToolCall("b", "question", {
        question: "second?",
        options: [{ label: "Yes" }],
      }),
      toolResult("b", "question", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 31,
      stubbedCount: 0,
    });
  });

  it("ignores multi_tool_use.parallel results entirely", () => {
    const log = vi.fn();
    const messages = [
      parallelToolCall("a"),
      toolResult("a", "multi_tool_use.parallel", big()),
      parallelToolCall("b"),
      toolResult("b", "multi_tool_use.parallel", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 31,
      stubbedCount: 0,
    });
  });

  it("does not prune unlisted textual tool by superseded", () => {
    const messages = [
      assistantToolCall("a", "custom_tool", { path: "file.txt" }),
      toolResult("a", "custom_tool", "old content"),
      assistantToolCall("b", "custom_tool", { path: "file.txt" }),
      toolResult("b", "custom_tool", "new content"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("old content");
    expect(textOf(pruned[3]!)).toBe("new content");
  });

  it("does not prune or count unlisted textual tool by stale_large", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "custom_tool", { input: "x" }),
      toolResult("a", "custom_tool", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: { log },
    });

    expect(textOf(pruned[1]!)).toBe(big());
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 31,
      stubbedCount: 0,
    });
  });
});
