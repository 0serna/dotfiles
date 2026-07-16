import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { formatDuration } from "./format.ts";
import { ThroughputTracker, isOutputDeltaEvent } from "./throughput.ts";

export default function (pi: ExtensionAPI) {
  let startTime: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let modelSlug = "";
  let initialModelSlug = "unknown";
  let lastRespondingModelSlug: string | null = null;
  let responseModelSlug: string | null = null;
  let thinkingLevel: string = "off";
  let responseThinkingLevel: string | null = null;
  let firstDeltaMs: number | null = null;
  let streamEndTime: number | null = null;
  let streamsCount = 0;
  let logger: ExtensionLogger | undefined;
  const throughput = new ThroughputTracker();

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function buildLabel(
    model: string,
    timeStr: string,
    tokPerSec: string | null,
  ): string {
    const modelLabel =
      thinkingLevel !== "off" ? `${model}/${thinkingLevel}` : model;
    const waitDuration =
      firstDeltaMs !== null
        ? formatDuration(Date.now() - streamEndTime!)
        : timeStr;
    const metrics = tokPerSec ?? `idle ${waitDuration}`;
    return ` ${modelLabel} · ${timeStr} · ${metrics}`;
  }

  function updateWorkingMessage(ctx: ExtensionContext): void {
    if (startTime === null) return;
    const timeStr = formatDuration(Date.now() - startTime);
    ctx.ui.setWorkingMessage(
      ctx.ui.theme.fg(
        "muted",
        buildLabel(modelSlug, timeStr, throughput.getDisplay()),
      ),
    );
  }

  pi.on("agent_start", (_event, ctx) => {
    if (startTime === null) {
      startTime = Date.now();
      modelSlug = ctx.model?.id ?? "unknown";
      initialModelSlug = modelSlug;
      lastRespondingModelSlug = null;
      thinkingLevel = pi.getThinkingLevel();
      firstDeltaMs = null;
      streamEndTime = null;
      streamsCount = 0;
      throughput.reset();
    }
    ctx.ui.setWorkingIndicator({
      frames: ["◐", "◓", "◑", "◒"].map((f) => ctx.ui.theme.fg("accent", f)),
      intervalMs: 120,
    });
    logger ??= createExtensionLogger(ctx, "working-stats");
    updateWorkingMessage(ctx);
    intervalId ??= setInterval(() => updateWorkingMessage(ctx), 1000);
  });

  pi.on("turn_start", () => {
    responseModelSlug = null;
    responseThinkingLevel = pi.getThinkingLevel();
  });

  pi.on("message_update", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    if (!isOutputDeltaEvent(event.assistantMessageEvent)) return;
    const delta = event.assistantMessageEvent.delta;
    if (!delta) return;
    if (throughput.phase !== "streaming") {
      thinkingLevel = responseThinkingLevel ?? pi.getThinkingLevel();
      throughput.startStream();
      if (firstDeltaMs === null) {
        firstDeltaMs = Date.now();
      }
    }
    const partial = event.assistantMessageEvent.partial as {
      model?: string;
      responseModel?: string;
    };
    const newModel = partial.responseModel ?? partial.model;
    if (newModel) {
      responseModelSlug = newModel;
      if (newModel !== modelSlug) {
        modelSlug = newModel;
        updateWorkingMessage(ctx);
      }
    }
    throughput.addDelta(delta);
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const msg = event.message;
    lastRespondingModelSlug =
      msg.responseModel ?? responseModelSlug ?? msg.model;
    thinkingLevel = responseThinkingLevel ?? thinkingLevel;
    responseModelSlug = null;
    responseThinkingLevel = null;
    throughput.endStream(msg.usage.output);
    streamEndTime = Date.now();
    streamsCount++;
    logger?.log("stream", {
      model: lastRespondingModelSlug ?? modelSlug,
      thinking: thinkingLevel,
      ttft_ms: firstDeltaMs !== null ? firstDeltaMs - startTime! : null,
      tps: throughput.getFinalThroughput(),
      duration_ms: streamEndTime - startTime!,
      tokens: typeof msg.usage.output === "number" ? msg.usage.output : null,
    });
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!ctx.isIdle()) return;
    clearLiveInterval();
    if (startTime !== null) {
      const timeStr = formatDuration(Date.now() - startTime);
      const check = ctx.ui.theme.fg("accent", "✓");
      logger?.log("session", {
        model: lastRespondingModelSlug ?? initialModelSlug,
        thinking: thinkingLevel,
        ttft_ms: firstDeltaMs !== null ? firstDeltaMs - startTime! : null,
        tps: throughput.getFinalThroughput(),
        streams_count: streamsCount,
        total_duration_ms: Date.now() - startTime,
      });
      const data = ctx.ui.theme.fg(
        "muted",
        buildLabel(
          lastRespondingModelSlug ?? initialModelSlug,
          timeStr,
          throughput.getFinalThroughput(),
        ),
      );
      ctx.ui.notify(`${check} ${data}`, "info");
      startTime = null;
    }
    ctx.ui.setWorkingMessage();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    clearLiveInterval();
    startTime = null;
    initialModelSlug = "unknown";
    lastRespondingModelSlug = null;
    responseModelSlug = null;
    thinkingLevel = "off";
    responseThinkingLevel = null;
    firstDeltaMs = null;
    streamEndTime = null;
    streamsCount = 0;
    throughput.reset();
    ctx.ui.setWorkingMessage();
  });
}
