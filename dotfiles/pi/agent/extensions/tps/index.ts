import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  computeThroughput,
  estimateTokensFromDelta,
  formatThroughput,
  isOutputDeltaEvent,
} from "./core.ts";

const STATUS_KEY = "tps";

export default function (pi: ExtensionAPI) {
  let streamStartTime: number | null = null;
  let estimatedTokens = 0;
  let liveIntervalId: ReturnType<typeof setInterval> | null = null;
  function clearLiveInterval(): void {
    if (liveIntervalId !== null) {
      clearInterval(liveIntervalId);
      liveIntervalId = null;
    }
  }

  function publishDimStatus(
    ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1],
    status: string,
  ): void {
    ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", status));
  }

  pi.on("session_start", (_event, ctx) => {
    publishDimStatus(ctx, "- tok/s");
  });

  pi.on("message_update", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    if (!isOutputDeltaEvent(event.assistantMessageEvent)) return;

    const delta = event.assistantMessageEvent.delta;
    if (!delta) return;

    if (streamStartTime === null) {
      streamStartTime = Date.now();
      estimatedTokens = 0;
      clearLiveInterval();

      liveIntervalId = setInterval(() => {
        if (streamStartTime === null) return;
        const elapsed = Date.now() - streamStartTime;
        const throughput = computeThroughput(estimatedTokens, elapsed);
        if (throughput !== null) {
          publishDimStatus(ctx, formatThroughput(throughput));
        }
      }, 1000);
    }

    estimatedTokens += estimateTokensFromDelta(delta);
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;

    clearLiveInterval();

    if (streamStartTime !== null) {
      const elapsed = Date.now() - streamStartTime;
      const outputTokens = event.message.usage?.output;

      if (typeof outputTokens === "number" && outputTokens > 0) {
        const throughput = computeThroughput(outputTokens, elapsed);
        if (throughput !== null) {
          publishDimStatus(ctx, formatThroughput(throughput));
        }
      }
      // If no usage available, preserve lastFinalStatus (no action needed)

      streamStartTime = null;
      estimatedTokens = 0;
    }
  });

  pi.on("session_shutdown", () => {
    clearLiveInterval();
    streamStartTime = null;
    estimatedTokens = 0;
  });
}
