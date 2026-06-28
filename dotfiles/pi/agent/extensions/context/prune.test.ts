import { describe, expect, it, vi } from "vitest";
import { pruneMessages } from "./prune.ts";

interface Message {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

function assistantToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
): Message {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
  };
}

function toolResult(
  id: string,
  name: string,
  text: string,
  isError = false,
): Message {
  return {
    role: "toolResult",
    toolCallId: id,
    toolName: name,
    content: [{ type: "text", text }],
    isError,
  };
}

function dcpTail(count = 16): Message[] {
  return Array.from({ length: count }, (_, index) => [
    assistantToolCall(`tail-call-${index}`, "bash", {
      command: `echo ${index}`,
    }),
    toolResult(`tail-call-${index}`, "bash", `tail output ${index}`),
  ]).flat();
}

function questionTail(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => [
    assistantToolCall(`question-${index}`, "question", {
      question: `question ${index}?`,
      options: [{ label: "Yes" }],
    }),
    toolResult(`question-${index}`, "question", "Yes"),
  ]).flat();
}

function parallelToolCall(id: string): Message {
  return assistantToolCall(id, "multi_tool_use.parallel", {
    tool_uses: [
      {
        recipient_name: "functions.read",
        parameters: { path: "src/a.ts" },
      },
    ],
  });
}

function textOf(message: Message): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const first = content[0] as { text?: string } | undefined;
  return first?.text ?? "";
}

describe("context DCP pruning", () => {
  it("stubs duplicate non-recent tool results", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "same output"),
      assistantToolCall("b", "read", { path: "src/b.ts" }),
      toolResult("b", "read", "same output"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("same output");
    expect(textOf(pruned[3]!)).toContain("reason=duplicate");
  });

  it("ignores question results entirely", () => {
    const log = vi.fn();
    const messages = [
      assistantToolCall("a", "question", {
        question: "first?",
        options: [{ label: "Yes" }],
      }),
      toolResult("a", "question", "Yes"),
      assistantToolCall("b", "question", {
        question: "second?",
        options: [{ label: "Yes" }],
      }),
      toolResult("b", "question", "Yes"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe("Yes");
    expect(textOf(pruned[3]!)).toBe("Yes");
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 16,
      stubbedCount: 0,
    });
  });

  it("ignores multi_tool_use.parallel results entirely", () => {
    const log = vi.fn();
    const largeText = "x".repeat(10_004);
    const messages = [
      parallelToolCall("a"),
      toolResult("a", "multi_tool_use.parallel", largeText),
      parallelToolCall("b"),
      toolResult("b", "multi_tool_use.parallel", largeText),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(largeText);
    expect(textOf(pruned[3]!)).toBe(largeText);
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 16,
      stubbedCount: 0,
    });
  });

  it("stubs resolved errors only when followed by later success for the same operation", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "npm test" }),
      toolResult("a", "bash", "Error: failed", true),
      assistantToolCall("b", "bash", { command: "npm test" }),
      toolResult("b", "bash", "ok"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=resolved");
    expect(textOf(pruned[3]!)).toBe("ok");
  });

  it("does not resolve errors for tools without a confident operation target", () => {
    const messages = [
      assistantToolCall("a", "question", {
        question: "first?",
        options: [{ label: "No" }],
      }),
      toolResult("a", "question", "Error: invalid option", true),
      assistantToolCall("b", "question", {
        question: "second?",
        options: [{ label: "Yes" }],
      }),
      toolResult("b", "question", "Yes"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("Error: invalid option");
    expect(textOf(pruned[3]!)).toBe("Yes");
  });

  it("stubs same-tool superseded file operations targeting the same file", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "old file"),
      assistantToolCall("b", "read", { path: "src/a.ts" }),
      toolResult("b", "read", "new file"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe("new file");
  });

  it("does not supersede file operations from a different tool", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "old file"),
      assistantToolCall("b", "edit", { path: "src/a.ts" }),
      toolResult("b", "edit", "new file"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("old file");
    expect(textOf(pruned[3]!)).toBe("new file");
  });

  it("stubs stale large textual tool results after the age gate", () => {
    const largeText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", largeText),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("keeps large textual tool results inside the stale_large age gate", () => {
    const largeText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", largeText),
      ...dcpTail(15),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(largeText);
  });

  it("does not count question results in stale_large age or metrics", () => {
    const log = vi.fn();
    const largeText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", largeText),
      ...dcpTail(15),
      ...questionTail(5),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe(largeText);
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 16,
      stubbedCount: 0,
      staleLargeProtectedCount: 1,
    });
  });

  it("stubs stale large textual tool results for non-command tools", () => {
    const messages = [
      assistantToolCall("a", "web_fetch", { url: "https://example.com" }),
      toolResult("a", "web_fetch", "x".repeat(10_004)),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=stale_large");
  });

  it("keeps stale large read results", () => {
    const readText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "read", { path: "src/big.ts" }),
      toolResult("a", "read", readText),
      ...dcpTail(16),
    ];

    const { messages: pruned, metrics } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(readText);
    expect(metrics.staleLargeProtectedCount).toBe(0);
  });

  it("keeps stale large skill read results", () => {
    const skillText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("a", "read", skillText),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe(skillText);
  });

  it("stubs superseded skill read results", () => {
    const messages = [
      assistantToolCall("a", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("a", "read", "old skill"),
      assistantToolCall("b", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("b", "read", "new skill"),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded");
    expect(textOf(pruned[3]!)).toBe("new skill");
  });

  it("fails open when logging throws", () => {
    const largeText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", largeText),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: {
        log: () => {
          throw new Error("boom");
        },
      },
    });

    expect(pruned).not.toBe(messages);
    expect(textOf(pruned[1]!)).toBe(largeText);
  });

  it("does not mutate user messages, assistant messages, or original messages", () => {
    const user = { role: "user", content: "keep me" };
    const assistant = assistantToolCall("a", "bash", { command: "rg foo" });
    const result = toolResult("a", "bash", "x".repeat(10_004));
    const messages = [user, assistant, result, ...dcpTail(16)];

    const { messages: pruned } = pruneMessages(messages);

    expect(pruned[0]!).toBe(user);
    expect(pruned[1]!).toBe(assistant);
    expect(textOf(result)).toBe("x".repeat(10_004));
    expect(textOf(pruned[2]!)).toContain("reason=stale_large");
  });

  it("logs summary metrics without full original output", () => {
    const log = vi.fn();
    const secret = `secret-${"x".repeat(10_004)}`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", secret),
      ...dcpTail(16),
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
      processedCount: 17,
      stubbedCount: 1,
      staleLargeProtectedCount: 0,
      reasonCounts: {
        duplicate: 0,
        resolved: 0,
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
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: { log },
      contextSequence: 1,
    });

    expect(textOf(pruned[1]!)).toBe("unique output");
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      contextSequence: 1,
      processedCount: 17,
      stubbedCount: 0,
      estimatedSavedTokens: 0,
      estimatedSavedTokensByTool: {},
    });
  });

  it("does not prune unlisted textual tool by duplicate", () => {
    const messages = [
      assistantToolCall("a", "custom_tool", { input: "x" }),
      toolResult("a", "custom_tool", "same output"),
      assistantToolCall("b", "custom_tool", { input: "y" }),
      toolResult("b", "custom_tool", "same output"),
      ...dcpTail(16),
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
      ...dcpTail(16),
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
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("old content");
    expect(textOf(pruned[3]!)).toBe("new content");
  });

  it("does not prune or count unlisted textual tool by stale_large", () => {
    const log = vi.fn();
    const largeText = "x".repeat(10_004);
    const messages = [
      assistantToolCall("a", "custom_tool", { input: "x" }),
      toolResult("a", "custom_tool", largeText),
      ...dcpTail(16),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: { log },
    });

    expect(textOf(pruned[1]!)).toBe(largeText);
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 16,
      stubbedCount: 0,
      staleLargeProtectedCount: 0,
    });
  });
});
