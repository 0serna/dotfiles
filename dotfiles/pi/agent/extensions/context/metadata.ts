import { asRecord, truncateTarget } from "./content.js";
import { TARGET_MAX_LENGTH, type ToolMetadata } from "./types.js";

interface ToolCallMetadata {
  name: string;
  target: string;
  operationKey: string | null;
  isFileOperation: boolean;
}

const FILE_TOOL_NAMES = new Set(["read", "write", "edit"]);

function normalizedToolName(name: string): string {
  return name.toLowerCase().replace(/^functions[._-]/, "");
}

function stringArg(
  args: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function targetFromArgs(args: Record<string, unknown>): string | null {
  return (
    stringArg(args, [
      "path",
      "filePath",
      "filepath",
      "file",
      "target",
      "url",
    ]) ?? stringArg(args, ["command", "query", "pattern", "glob"])
  );
}

function isFileOperation(
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  const name = normalizedToolName(toolName);
  return (
    FILE_TOOL_NAMES.has(name) ||
    stringArg(args, ["path", "filePath", "filepath", "file"]) !== null
  );
}

function buildOperationKey(toolName: string, target: string): string {
  return `${normalizedToolName(toolName)}:${target.trim().toLowerCase()}`;
}

function parseToolCall(
  block: Record<string, unknown>,
): ToolCallMetadata | null {
  if (block.type !== "toolCall") return null;
  if (typeof block.name !== "string" || block.name.trim() === "") return null;

  const args = asRecord(block.arguments) ?? asRecord(block.args) ?? {};
  const target = targetFromArgs(args);

  return {
    name: block.name,
    target: truncateTarget(target ?? block.name, TARGET_MAX_LENGTH),
    operationKey:
      target === null ? null : buildOperationKey(block.name, target),
    isFileOperation: isFileOperation(block.name, args),
  };
}

export function collectToolCallMetadata(
  messages: readonly unknown[],
): Map<string, ToolCallMetadata> {
  const metadata = new Map<string, ToolCallMetadata>();

  for (const messageValue of messages) {
    const message = asRecord(messageValue);
    if (message?.role !== "assistant" || !Array.isArray(message.content))
      continue;

    for (const blockValue of message.content) {
      const block = asRecord(blockValue);
      if (block === null || typeof block.id !== "string") continue;
      const toolCall = parseToolCall(block);
      if (toolCall !== null) metadata.set(block.id, toolCall);
    }
  }

  return metadata;
}

export function metadataForToolResult(
  message: Record<string, unknown>,
  toolCalls: ReadonlyMap<string, ToolCallMetadata>,
): ToolMetadata | null {
  const rawToolCallId =
    typeof message.toolCallId === "string" ? message.toolCallId : null;
  const toolCall =
    rawToolCallId === null ? null : (toolCalls.get(rawToolCallId) ?? null);
  const toolName =
    toolCall?.name ??
    (typeof message.toolName === "string" ? message.toolName : null);
  if (toolName === null || toolName.trim() === "") return null;

  const target =
    toolCall?.target ?? truncateTarget(toolName, TARGET_MAX_LENGTH);
  const operationKey = toolCall?.operationKey ?? null;

  return {
    toolCallId: rawToolCallId,
    toolName,
    target,
    operationKey,
    isFileOperation:
      toolCall?.isFileOperation ??
      FILE_TOOL_NAMES.has(normalizedToolName(toolName)),
  };
}
