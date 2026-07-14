import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
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
    return ` ${modelLabel} · ${timeStr} · ${tokPerSec ?? "0 tok/s"}`;
  }

  function updateWorkingMessage(ctx: ExtensionContext): void {
    if (startTime === null) return;
    const elapsed = Date.now() - startTime;
    const timeStr = formatDuration(elapsed);
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
      throughput.reset();
    }
    ctx.ui.setWorkingIndicator({
      frames: ["◐", "◓", "◑", "◒"].map((f) => ctx.ui.theme.fg("accent", f)),
      intervalMs: 120,
    });
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
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!ctx.isIdle()) return;
    clearLiveInterval();
    if (startTime !== null) {
      const elapsed = Date.now() - startTime;
      const timeStr = formatDuration(elapsed);
      const check = ctx.ui.theme.fg("accent", "✓");
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
    throughput.reset();
    ctx.ui.setWorkingMessage();
  });
}
