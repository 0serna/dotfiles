import { describe, expect, it } from "vitest";
import { pruneMessages } from "../prune.ts";
import {
  assistantToolCall,
  big,
  dcpTail,
  textOf,
  toolResult,
} from "./prune.test-utils.ts";

describe("context DCP semantic identity", () => {
  it("keeps semantic read identity non-truncated for long paths", () => {
    const path = `src/${"deep/".repeat(30)}app.ts`;
    const messages = [
      assistantToolCall("a", "read", { path, offset: 1, limit: 10 }),
      toolResult("a", "read", "short range"),
      assistantToolCall("b", "read", { path, offset: 11, limit: 10 }),
      toolResult("b", "read", "other range"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("short range");
    expect(textOf(pruned[3]!)).toBe("other range");
  });

  it("does not supersede same-path read with different offset", () => {
    const messages = [
      assistantToolCall("a", "read", {
        path: "src/app.ts",
        offset: 1,
        limit: 50,
      }),
      toolResult("a", "read", "lines 1-50"),
      assistantToolCall("b", "read", {
        path: "src/app.ts",
        offset: 251,
        limit: 50,
      }),
      toolResult("b", "read", "lines 251+"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("lines 1-50");
    expect(textOf(pruned[3]!)).toBe("lines 251+");
  });

  it("does not resolve read errors when later read covers different range", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/app.ts" }),
      toolResult("a", "read", `Error: ${big()}`, true),
      assistantToolCall("b", "read", { path: "src/app.ts", offset: 251 }),
      toolResult("b", "read", "ok"),
      ...dcpTail(29),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(`Error: ${big()}`);
    expect(textOf(pruned[3]!)).toBe("ok");
  });

  it("supersedes same-path read with identical range", () => {
    const messages = [
      assistantToolCall("a", "read", {
        path: "src/app.ts",
        offset: 100,
        limit: 10,
      }),
      toolResult("a", "read", big()),
      assistantToolCall("b", "read", {
        path: "src/app.ts",
        offset: 100,
        limit: 10,
      }),
      toolResult("b", "read", big()),
      ...dcpTail(29),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe(big());
  });

  it("does not supersede independent edits to the same file", () => {
    const messages = [
      assistantToolCall("a", "edit", {
        path: "src/app.ts",
        edits: [{ oldText: "a", newText: "b" }],
      }),
      toolResult("a", "edit", "first edit output"),
      assistantToolCall("b", "edit", {
        path: "src/app.ts",
        edits: [{ oldText: "c", newText: "d" }],
      }),
      toolResult("b", "edit", "second edit output"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("first edit output");
    expect(textOf(pruned[3]!)).toBe("second edit output");
  });

  it("resolves edit errors only with identical edit payload", () => {
    const edits = [{ oldText: "old", newText: "new" }];
    const messages = [
      assistantToolCall("a", "edit", { path: "src/app.ts", edits }),
      toolResult("a", "edit", `Error: ${big()}`, true),
      assistantToolCall("b", "edit", {
        path: "src/app.ts",
        edits: [{ oldText: "other", newText: "new" }],
      }),
      toolResult("b", "edit", "different edit ok"),
      assistantToolCall("c", "edit", { path: "src/app.ts", edits }),
      toolResult("c", "edit", "same edit ok"),
      ...dcpTail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=resolved");
    expect(textOf(pruned[3]!)).toBe("different edit ok");
    expect(textOf(pruned[5]!)).toBe("same edit ok");
  });

  it("still supersedes later writes to the same path", () => {
    const messages = [
      assistantToolCall("a", "write", { path: "src/out.txt", content: "old" }),
      toolResult("a", "write", big()),
      assistantToolCall("b", "write", { path: "src/out.txt", content: "new" }),
      toolResult("b", "write", big()),
      ...dcpTail(29),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe(big());
  });
});
