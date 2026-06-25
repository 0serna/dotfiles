import { createHash } from "crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function extractTextContent(
  message: Record<string, unknown>,
): string | null {
  const content = message.content;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts: string[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
    }
  }

  return textParts.length > 0 ? textParts.join("\n") : null;
}

export function replaceTextContent(
  message: Record<string, unknown>,
  text: string,
): Record<string, unknown> {
  return {
    ...message,
    content: Array.isArray(message.content) ? [{ type: "text", text }] : text,
  };
}

export function normalizeContent(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hashNormalizedContent(text: string): string {
  return createHash("sha256").update(normalizeContent(text)).digest("hex");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateTarget(target: string, maxLength: number): string {
  const normalized = target.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}
