import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

/**
 * Estimate token count from a streamed delta string.
 * Uses a conservative heuristic of characters / 4, matching Pi's internal approach.
 */
export function estimateTokensFromDelta(delta: string): number {
  return Math.ceil(delta.length / 4);
}

/**
 * Format a throughput value as `<integer> tok/s` with integer rounding.
 */
export function formatThroughput(tokensPerSecond: number): string {
  return `${Math.round(tokensPerSecond)} tok/s`;
}

/**
 * Compute output throughput from estimated tokens and elapsed time.
 * Returns null if the elapsed time is less than 1 second (unstable) or if
 * the inputs are invalid.
 */
export function computeThroughput(
  estimatedTokens: number,
  elapsedMs: number,
): number | null {
  if (elapsedMs <= 0 || estimatedTokens <= 0) return null;
  const elapsedSec = elapsedMs / 1000;
  if (elapsedSec < 1) return null;
  return estimatedTokens / elapsedSec;
}

/**
 * Check if an assistant message event carries a delta with countable content
 * (text, thinking, or tool-call delta).
 */
export function isOutputDeltaEvent(
  event: AssistantMessageEvent,
): event is Extract<
  AssistantMessageEvent,
  { type: "text_delta" | "thinking_delta" | "toolcall_delta" }
> {
  return (
    event.type === "text_delta" ||
    event.type === "thinking_delta" ||
    event.type === "toolcall_delta"
  );
}
