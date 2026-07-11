import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

/**
 * Estimate token count from a streamed delta string.
 * Uses a conservative heuristic of characters / 4, matching Pi's internal approach.
 */
function estimateTokensFromDelta(delta: string): number {
  return Math.ceil(delta.length / 4);
}

/**
 * Format a throughput value as `<integer> tok/s` with integer rounding.
 */
function formatThroughput(tokensPerSecond: number): string {
  return `${Math.round(tokensPerSecond)} tok/s`;
}

/**
 * Compute output throughput from estimated tokens and elapsed time.
 * Returns null when inputs are invalid (non-positive elapsed or tokens).
 */
function computeThroughput(
  estimatedTokens: number,
  elapsedMs: number,
): number | null {
  if (elapsedMs <= 0 || estimatedTokens <= 0) return null;
  const elapsedSec = elapsedMs / 1000;
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

type Phase = "idle" | "streaming" | "final";

/**
 * Tracks assistant token throughput across the lifecycle of one or more
 * streams within a session. States: `idle → streaming → final`. The
 * final throughput is only retrieved when the agent ends; during tool
 * execution the display reverts to the placeholder.
 */
export class ThroughputTracker {
  private _phase: Phase = "idle";
  private streamStart: number | null = null;
  private estimatedTokens = 0;
  private lastFinal: number | null = null;

  /** Current lifecycle phase, exposed for callers that drive the state machine. */
  get phase(): Phase {
    return this._phase;
  }

  /**
   * Transition to the `streaming` phase and reset the live token counter.
   * The clock is started on the first `addDelta` call, so any latency
   * between the stream opening and the first output delta is excluded from
   * the throughput calculation.
   */
  startStream(): void {
    this._phase = "streaming";
    this.streamStart = null;
    this.estimatedTokens = 0;
  }

  /**
   * Accumulate estimated output tokens from a streamed delta. The first
   * call in a stream captures the start time, so the throughput is measured
   * from the first output delta. Has no effect when not in the `streaming`
   * phase.
   */
  addDelta(delta: string): void {
    if (this._phase !== "streaming") return;
    if (this.streamStart === null) {
      this.streamStart = Date.now();
    }
    this.estimatedTokens += estimateTokensFromDelta(delta);
  }

  /**
   * Finish the current stream. When `preciseTokens` is a positive number
   * the final throughput is recomputed from provider-reported output tokens
   * and stored. Otherwise the previous `lastFinal` is preserved. Has no
   * effect when not in the `streaming` phase.
   */
  endStream(preciseTokens?: number): void {
    if (this._phase !== "streaming") return;
    if (
      this.streamStart !== null &&
      typeof preciseTokens === "number" &&
      preciseTokens > 0
    ) {
      const elapsed = Date.now() - this.streamStart;
      const final = computeThroughput(preciseTokens, elapsed);
      if (final !== null) {
        this.lastFinal = final;
      }
    }
    this._phase = "final";
    this.streamStart = null;
    this.estimatedTokens = 0;
  }

  /**
   * Return all state to `idle`, discarding both live and final values.
   */
  reset(): void {
    this._phase = "idle";
    this.streamStart = null;
    this.estimatedTokens = 0;
    this.lastFinal = null;
  }

  /**
   * Render the current throughput for the working message.
   *
   * - `null` while idle or before the first delta arrives.
   * - `"N tok/s"` during an active stream.
   * - `null` after a stream ends (placeholder takes over).
   */
  getDisplay(): string | null {
    if (this._phase === "idle") return null;

    if (this._phase === "streaming") {
      if (this.streamStart === null) return null;
      const elapsed = Date.now() - this.streamStart;
      const live = computeThroughput(this.estimatedTokens, elapsed);
      return live === null ? null : formatThroughput(live);
    }

    return null;
  }

  /**
   * Retrieve the last final throughput for the completion notification.
   * Returns the formatted value (e.g. `"48 tok/s"`) with no suffix,
   * or `null` if no final value has been recorded.
   */
  getFinalThroughput(): string | null {
    if (this.lastFinal === null) return null;
    return formatThroughput(this.lastFinal);
  }
}
