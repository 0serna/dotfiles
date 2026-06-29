export interface Message {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

export function assistantToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
): Message {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
  };
}

export function toolResult(
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

export function dcpTail(count = 31): Message[] {
  return Array.from({ length: count }, (_, index) => [
    assistantToolCall(`tail-call-${index}`, "bash", {
      command: `echo ${index}`,
    }),
    toolResult(`tail-call-${index}`, "bash", `tail output ${index}`),
  ]).flat();
}

export function questionTail(count: number): Message[] {
  return Array.from({ length: count }, (_, index) => [
    assistantToolCall(`question-${index}`, "question", {
      question: `question ${index}?`,
      options: [{ label: "Yes" }],
    }),
    toolResult(`question-${index}`, "question", "Yes"),
  ]).flat();
}

export function parallelToolCall(id: string): Message {
  return assistantToolCall(id, "multi_tool_use.parallel", {
    tool_uses: [
      {
        recipient_name: "functions.read",
        parameters: { path: "src/a.ts" },
      },
    ],
  });
}

export function textOf(message: Message): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const first = content[0] as { text?: string } | undefined;
  return first?.text ?? "";
}

export function big(n = 10_004): string {
  return "x".repeat(n);
}
