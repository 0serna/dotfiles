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

function tail(count = 20): Message[] {
  return Array.from({ length: count }, (_, index) => ({
    role: "user",
    content: `tail ${index}`,
  }));
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
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("same output");
    expect(textOf(pruned[3]!)).toContain("reason=duplicate_output");
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
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages, { logger: { log } });

    expect(textOf(pruned[1]!)).toBe("Yes");
    expect(textOf(pruned[3]!)).toBe("Yes");
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      processedCount: 0,
      stubbedCount: 0,
    });
  });

  it("stubs resolved errors only when followed by later success for the same operation", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "npm test" }),
      toolResult("a", "bash", "Error: failed", true),
      assistantToolCall("b", "bash", { command: "npm test" }),
      toolResult("b", "bash", "ok"),
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=resolved_error");
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
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toBe("Error: invalid option");
    expect(textOf(pruned[3]!)).toBe("Yes");
  });

  it("stubs superseded file operations targeting the same file", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/a.ts" }),
      toolResult("a", "read", "old file"),
      assistantToolCall("b", "edit", { path: "src/a.ts" }),
      toolResult("b", "edit", "new file"),
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded_file_operation");
    expect(textOf(pruned[3]!)).toBe("new file");
  });

  it("stubs old large textual tool results", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", "x".repeat(8_004)),
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=old_large_output");
  });

  it("protects the last 15 messages", () => {
    const messages = [
      { role: "user", content: "older" },
      ...tail(13),
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", "x".repeat(8_004)),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[15]!)).toBe("x".repeat(8_004));
  });

  it("stubs old large textual tool results for non-command tools", () => {
    const messages = [
      assistantToolCall("a", "read", { path: "src/big.ts" }),
      toolResult("a", "read", "x".repeat(6_004)),
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=old_large_output");
  });

  it("keeps old large skill read results", () => {
    const skillText = "x".repeat(8_004);
    const messages = [
      assistantToolCall("a", "read", {
        path: "/home/user/.agents/skills/review/SKILL.md",
      }),
      toolResult("a", "read", skillText),
      ...tail(),
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
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages);

    expect(textOf(pruned[1]!)).toContain("reason=superseded_file_operation");
    expect(textOf(pruned[3]!)).toBe("new skill");
  });

  it("fails open when logging throws", () => {
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", "x".repeat(8_004)),
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: {
        log: () => {
          throw new Error("boom");
        },
      },
    });

    expect(pruned).not.toBe(messages);
    expect(textOf(pruned[1]!)).toBe("x".repeat(8_004));
  });

  it("does not mutate user messages, assistant messages, or original messages", () => {
    const user = { role: "user", content: "keep me" };
    const assistant = assistantToolCall("a", "bash", { command: "rg foo" });
    const result = toolResult("a", "bash", "x".repeat(8_004));
    const messages = [user, assistant, result, ...tail()];

    const { messages: pruned } = pruneMessages(messages);

    expect(pruned[0]!).toBe(user);
    expect(pruned[1]!).toBe(assistant);
    expect(textOf(result)).toBe("x".repeat(8_004));
    expect(textOf(pruned[2]!)).toContain("reason=old_large_output");
  });

  it("logs summary metrics without full original output", () => {
    const log = vi.fn();
    const secret = `secret-${"x".repeat(8_004)}`;
    const messages = [
      assistantToolCall("a", "bash", { command: "rg foo" }),
      toolResult("a", "bash", secret),
      ...tail(),
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
      processedCount: 1,
      stubbedCount: 1,
      protectedRecentCount: 0,
      reasonCounts: {
        duplicate_output: 0,
        resolved_error: 0,
        superseded_file_operation: 0,
        old_large_output: 1,
      },
    });
    expect(metrics).toStrictEqual(payload);
    expect(payload.estimatedSavedTokens).toEqual(expect.any(Number));
    expect(payload.estimatedSavedTokens).toBeGreaterThan(0);
    expect(payload.estimatedSavedTokensByReason).toMatchObject({
      old_large_output: payload.estimatedSavedTokens,
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
      ...tail(),
    ];

    const { messages: pruned } = pruneMessages(messages, {
      logger: { log },
      contextSequence: 1,
    });

    expect(textOf(pruned[1]!)).toBe("unique output");
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[1]).toMatchObject({
      contextSequence: 1,
      processedCount: 1,
      stubbedCount: 0,
      estimatedSavedTokens: 0,
      estimatedSavedTokensByTool: {},
    });
  });
});
