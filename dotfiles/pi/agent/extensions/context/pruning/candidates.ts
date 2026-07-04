import { asRecord, extractTextContent } from "../content.js";
import { collectToolCallMetadata, metadataForToolResult } from "../metadata.js";
import type { ToolResultCandidate } from "../types.js";
import { isIgnoredTool, pruningPolicyFor } from "./policy.js";

function isToolResult(message: Record<string, unknown>): boolean {
  return message.role === "toolResult";
}

function isErrorResult(
  message: Record<string, unknown>,
  text: string,
): boolean {
  return (
    message.isError === true ||
    /(^|\n)(error|failed|command exited with code [1-9])/i.test(text)
  );
}

export function collectCandidates(
  messages: readonly unknown[],
): ToolResultCandidate[] {
  const toolCalls = collectToolCallMetadata(messages);
  const candidates: ToolResultCandidate[] = [];

  messages.forEach((messageValue, index) => {
    const message = asRecord(messageValue);
    if (message === null || !isToolResult(message)) return;

    const text = extractTextContent(message);
    if (text === null) return;

    const metadata = metadataForToolResult(message, toolCalls);
    if (metadata === null || isIgnoredTool(metadata.toolName)) return;

    const policy = pruningPolicyFor(metadata.toolName);
    if (policy === undefined) return;

    candidates.push({
      index,
      message,
      text,
      isError: isErrorResult(message, text),
      metadata,
      dcpAge: 0,
      policy,
    });
  });

  return candidates.map((candidate, candidateIndex) => ({
    ...candidate,
    dcpAge: candidates.length - candidateIndex - 1,
  }));
}
