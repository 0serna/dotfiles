import { describe, expect, it, vi } from "vitest";
import { pruneMessages } from "../prune.ts";
import {
  assistantToolCall,
  big,
  dcpTail,
  questionTail,
  textOf,
  toolResult,
} from "./prune.test-utils.ts";

describe("context DCP pruning mechanisms", () => {
  it("keeps duplicate web_search results", () => {
    const messages = [
      assistantToolCall("a", "web_search", { query: "first" }),
      toolResult("a", "web_search", big()),
      assistantToolCall("b", "web_search", { query: "second" }),
      toolResult("b", "web_search", big()),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("keeps duplicate bash results (no longer deduplicated)", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "echo same" }),
      toolResult("a", "bash", big()),
      assistantToolCall("b", "bash", { command: "printf same" }),
      toolResult("b", "bash", big()),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("keeps duplicate web_fetch results (no longer deduplicated)", () => {
    const messages = [
      assistantToolCall("a", "web_fetch", { url: "https://example.com/a" }),
      toolResult("a", "web_fetch", big()),
      assistantToolCall("b", "web_fetch", { url: "https://example.com/b" }),
      toolResult("b", "web_fetch", big()),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("keeps bash error followed by later success (no longer resolved)", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "npm test" }),
      toolResult("a", "bash", `Error: ${big()}`, true),
      assistantToolCall("b", "bash", { command: "npm test" }),
      toolResult("b", "bash", "ok"),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(`Error: ${big()}`);
    expect(textOf(pruned[3]!)).toBe("ok");
  });

  it("stubs same-tool superseded file operations targeting the same file", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "read", { path: "src/a.ts" }),
      toolResult("b", "read", big()),
      ...dcpTail(19),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("preserves superseded results below threshold", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "old file"),
      assistantToolCall("b", "read", { path: "src/a.ts" }),
      toolResult("b", "read", "new file"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("old file");
    expect(textOf(pruned[3]!)).toBe("new file");
  });

  it("does not supersede file operations from a different tool", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "edit", { path: "src/a.ts" }),
      toolResult("b", "edit", big()),
      ...dcpTail(19),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("stubs stale large textual tool results after the age gate", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("keeps large textual tool results inside the stale_large age gate", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(20),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
  });

  it("does not count question results in stale_large age or metrics", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(20),
      ...questionTail(5),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(big());
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 21,
      stubbedCount: 0,
    });
  });

  it("stubs stale large textual tool results for non-command tools", () => {
    const messages = [
      assistantToolCall("a", "web_fetch", { url: "https://example.com" }),
      toolResult("a", "web_fetch", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("stubs stale large edit results", () => {
    const messages = [
      assistantToolCall("a", "edit", {
        path: "src/app.ts",
        edits: [{ oldText: "a", newText: "b" }],
      }),
      toolResult("a", "edit", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("stubs stale large write results", () => {
    const messages = [
      assistantToolCall("a", "write", { path: "src/app.ts", content: "x" }),
      toolResult("a", "write", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("keeps stale large read results", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/big.ts" }),
      toolResult("a", "read", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
  });
});
