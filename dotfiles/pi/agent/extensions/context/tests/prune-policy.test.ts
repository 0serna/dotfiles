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
  it("preserves duplicate results below threshold", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "echo same" }),
      toolResult("a", "bash", "same output"),
      assistantToolCall("b", "bash", { command: "printf same" }),
      toolResult("b", "bash", "same output"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("same output");
    expect(textOf(pruned[3]!)).toBe("same output");
  });

  it("keeps duplicate file tool results", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "read", { path: "src/b.ts" }),
      toolResult("b", "read", big()),
      assistantToolCall("c", "edit", {
        path: "src/c.ts",
        edits: [{ oldText: "a", newText: "b" }],
      }),
      toolResult("c", "edit", big()),
      assistantToolCall("d", "write", { path: "src/d.ts", content: "x" }),
      toolResult("d", "write", big()),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
    expect(textOf(pruned[5]!)).toBe(big());
    expect(textOf(pruned[7]!)).toBe(big());
  });

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

  it("does not prune unlisted textual tool by duplicate", () => {
    const messages = [
      assistantToolCall("a", "custom_tool", { input: "x" }),
      toolResult("a", "custom_tool", "same output"),
      assistantToolCall("b", "custom_tool", { input: "y" }),
      toolResult("b", "custom_tool", "same output"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("same output");
    expect(textOf(pruned[3]!)).toBe("same output");
  });

  it("does not prune unlisted textual tool by resolved", () => {
    const messages = [
      assistantToolCall("a", "custom_tool", { input: "x" }),
      toolResult("a", "custom_tool", "Error: failed", true),
      assistantToolCall("b", "custom_tool", { input: "x" }),
      toolResult("b", "custom_tool", "ok"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("Error: failed");
    expect(textOf(pruned[3]!)).toBe("ok");
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
      staleLargeProtectedCount: 0,
    });
  });
});
