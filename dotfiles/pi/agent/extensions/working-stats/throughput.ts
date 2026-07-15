import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

function estimateTokensFromDelta(delta: string): number {
  return Math.ceil(delta.length / 4);
}

function formatThroughput(tokensPerSecond: number): string {
  return `${Math.round(tokensPerSecond)} tps`;
}

function computeThroughput(
  estimatedTokens: number,
  elapsedMs: number,
): number | null {
  if (elapsedMs <= 0 || estimatedTokens <= 0) return null;
  return estimatedTokens / (elapsedMs / 1000);
}

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

/** Tracks assistant token throughput across streams within a session. */
export class ThroughputTracker {
  private _phase: Phase = "idle";
  private streamStart: number | null = null;
  private estimatedTokens = 0;
  private lastFinal: number | null = null;

  get phase(): Phase {
    return this._phase;
  }

  startStream(): void {
    this._phase = "streaming";
    this.streamStart = null;
    this.estimatedTokens = 0;
  }

  addDelta(delta: string): void {
    if (this._phase !== "streaming") return;
    if (this.streamStart === null) {
      this.streamStart = Date.now();
    }
    this.estimatedTokens += estimateTokensFromDelta(delta);
  }

  /** Finish the current stream. Prefers provider-reported tokens when available. */
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

  reset(): void {
    this._phase = "idle";
    this.streamStart = null;
    this.estimatedTokens = 0;
    this.lastFinal = null;
  }

  getDisplay(): string | null {
    if (this._phase !== "streaming" || this.streamStart === null) return null;
    const elapsed = Date.now() - this.streamStart;
    if (elapsed < 500) return null;
    const live = computeThroughput(this.estimatedTokens, elapsed);
    return live === null ? null : formatThroughput(live);
  }

  getFinalThroughput(): string | null {
    if (this.lastFinal === null) return null;
    return formatThroughput(this.lastFinal);
  }
}
