import { asRecord, normalizedToolName, truncateTarget } from "./content.js";
import { TARGET_MAX_LENGTH, type ToolMetadata } from "./types.js";

interface ToolCallMetadata {
  name: string;
  target: string;
  semanticOperationKey: string | null;
  supersedeKey: string | null;
  isFileOperation: boolean;
  isSkillRead: boolean;
}

const FILE_TOOL_NAMES = new Set(["read", "write", "edit"]);

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

function isSkillPath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, "/").toLowerCase();
  return normalized === "skill.md" || normalized.endsWith("/skill.md");
}

function isSkillRead(toolName: string, args: Record<string, unknown>): boolean {
  if (normalizedToolName(toolName) !== "read") return false;
  const path = stringArg(args, ["path", "filePath", "filepath", "file"]);
  return path !== null && isSkillPath(path);
}

function buildOperationKey(toolName: string, target: string): string {
  return `${normalizedToolName(toolName)}:${target.trim().toLowerCase()}`;
}

function normalizedPathValue(path: string): string {
  return path.trim().replace(/\\/g, "/").toLowerCase();
}

function pathKeyPart(args: Record<string, unknown>): string | null {
  const path = stringArg(args, ["path", "filePath", "filepath", "file"]);
  return path === null ? null : normalizedPathValue(path);
}

function stableJsonKeyPart(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (
      nestedValue &&
      typeof nestedValue === "object" &&
      !Array.isArray(nestedValue)
    ) {
      const entries = Object.entries(
        nestedValue as Record<string, unknown>,
      ).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return Object.fromEntries(entries);
    }

    return nestedValue;
  });
}

function numberArg(
  args: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function readSemanticKey(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  const pathPart = pathKeyPart(args);
  if (pathPart === null) return null;
  const offset = numberArg(args, ["offset"]);
  const limit = numberArg(args, ["limit"]);
  return `${normalizedToolName(toolName)}:${pathPart}|offset:${String(offset ?? "none")}|limit:${String(limit ?? "none")}`;
}

function editResolvedKey(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  const pathPart = pathKeyPart(args);
  if (pathPart === null) return null;

  const edits = args["edits"];
  if (!Array.isArray(edits) || edits.length === 0) return null;

  return `${normalizedToolName(toolName)}:${pathPart}|edits:${stableJsonKeyPart(edits)}`;
}

function writeSemanticKey(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  const pathPart = pathKeyPart(args);
  if (pathPart === null) return null;
  return `${normalizedToolName(toolName)}:${pathPart}`;
}

function fileToolSemanticKey(
  toolName: string,
  args: Record<string, unknown>,
): { semanticOperationKey: string | null; supersedeKey: string | null } {
  const normalized = normalizedToolName(toolName);

  if (normalized === "read") {
    const key = readSemanticKey(toolName, args);
    return {
      semanticOperationKey: key,
      supersedeKey: readSemanticKey(toolName, args),
    };
  }

  if (normalized === "edit") {
    return {
      semanticOperationKey: editResolvedKey(toolName, args),
      supersedeKey: null,
    };
  }

  if (normalized === "write") {
    const key = writeSemanticKey(toolName, args);
    return { semanticOperationKey: key, supersedeKey: key };
  }

  const target = targetFromArgs(args);
  if (target === null)
    return { semanticOperationKey: null, supersedeKey: null };
  const key = buildOperationKey(toolName, target);
  return { semanticOperationKey: key, supersedeKey: key };
}

function parseToolCall(
  block: Record<string, unknown>,
): ToolCallMetadata | null {
  if (block.type !== "toolCall") return null;
  if (typeof block.name !== "string" || block.name.trim() === "") return null;

  const args = asRecord(block.arguments) ?? asRecord(block.args) ?? {};
  const target = targetFromArgs(args);
  const { semanticOperationKey, supersedeKey } = fileToolSemanticKey(
    block.name,
    args,
  );

  return {
    name: block.name,
    target: truncateTarget(target ?? block.name, TARGET_MAX_LENGTH),
    semanticOperationKey,
    supersedeKey,
    isFileOperation: isFileOperation(block.name, args),
    isSkillRead: isSkillRead(block.name, args),
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

  return {
    toolCallId: rawToolCallId,
    toolName,
    target,
    semanticOperationKey: toolCall?.semanticOperationKey ?? null,
    supersedeKey: toolCall?.supersedeKey ?? null,
    isFileOperation:
      toolCall?.isFileOperation ??
      FILE_TOOL_NAMES.has(normalizedToolName(toolName)),
    isSkillRead: toolCall?.isSkillRead ?? false,
  };
}
