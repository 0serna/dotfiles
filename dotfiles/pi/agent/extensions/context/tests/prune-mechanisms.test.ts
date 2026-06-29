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
  it("stubs older duplicate command results when above threshold", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "echo same" }),
      toolResult("a", "bash", big()),
      assistantToolCall("b", "bash", { command: "printf same" }),
      toolResult("b", "bash", big()),
      ...dcpTail(1),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=duplicate");
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("stubs resolved errors only when followed by later success for the same operation", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "npm test" }),
      toolResult("a", "bash", `Error: ${big()}`, true),
      assistantToolCall("b", "bash", { command: "npm test" }),
      toolResult("b", "bash", "ok"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=resolved");
    expect(textOf(pruned[3]!)).toBe("ok");
  });

  it("preserves resolved errors below threshold", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "npm test" }),
      toolResult("a", "bash", "Error: failed", true),
      assistantToolCall("b", "bash", { command: "npm test" }),
      toolResult("b", "bash", "ok"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("Error: failed");
    expect(textOf(pruned[3]!)).toBe("ok");
  });

  it("does not resolve errors for tools without a confident operation target", () => {
    const messages = [
      assistantToolCall("a", "question", {
        question: "first?",
        options: [{ label: "No" }],
      }),
      toolResult("a", "question", `Error: ${big()}`, true),
      assistantToolCall("b", "question", {
        question: "second?",
        options: [{ label: "Yes" }],
      }),
      toolResult("b", "question", "Yes"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(`Error: ${big()}`);
    expect(textOf(pruned[3]!)).toBe("Yes");
  });

  it("stubs same-tool superseded file operations targeting the same file", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "read", { path: "src/a.ts" }),
      toolResult("b", "read", big()),
      ...dcpTail(29),
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
      ...dcpTail(29),
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
      ...dcpTail(30),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
  });

  it("does not count question results in stale_large age or metrics", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", big()),
      ...dcpTail(30),
      ...questionTail(5),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(big());
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 31,
      stubbedCount: 0,
      staleLargeProtectedCount: 1,
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

  it("stubs stale large read results", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/big.ts" }),
      toolResult("a", "read", big()),
      ...dcpTail(),
    ];

    const { messages: pruned, metrics } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
    expect(metrics.staleLargeProtectedCount).toBe(0);
  });

  it("keeps stale large skill read results", () => {
    const messages = [
      assistantToolCall("a", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("a", "read", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(big());
  });

  it("stubs superseded skill read results", () => {
    const messages = [
      assistantToolCall("a", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("b", "read", big()),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe(big());
  });
});
