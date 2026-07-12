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
  const throughput = new ThroughputTracker();

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function buildLabel(timeStr: string, tokPerSec: string | null): string {
    return ` ${modelSlug} · ${timeStr} · ${tokPerSec ?? "0 tok/s"}`;
  }

  function updateWorkingMessage(ctx: ExtensionContext): void {
    if (startTime === null) return;
    const elapsed = Date.now() - startTime;
    const timeStr = formatDuration(elapsed);
    ctx.ui.setWorkingMessage(
      ctx.ui.theme.fg("muted", buildLabel(timeStr, throughput.getDisplay())),
    );
  }

  pi.on("agent_start", (_event, ctx) => {
    startTime = Date.now();
    modelSlug = ctx.model?.id ?? "unknown";
    clearLiveInterval();
    throughput.reset();
    ctx.ui.setWorkingIndicator({
      frames: ["◐", "◓", "◑", "◒"].map((f) => ctx.ui.theme.fg("accent", f)),
      intervalMs: 120,
    });
    updateWorkingMessage(ctx);
    intervalId = setInterval(() => updateWorkingMessage(ctx), 1000);
  });

  pi.on("model_select", (event, ctx) => {
    modelSlug = event.model.id;
    updateWorkingMessage(ctx);
  });

  pi.on("message_update", (event) => {
    if (event.message.role !== "assistant") return;
    if (!isOutputDeltaEvent(event.assistantMessageEvent)) return;
    const delta = event.assistantMessageEvent.delta;
    if (!delta) return;
    if (throughput.phase !== "streaming") {
      throughput.startStream();
    }
    throughput.addDelta(delta);
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    throughput.endStream(event.message.usage?.output);
  });

  pi.on("agent_end", (_event, ctx) => {
    clearLiveInterval();
    if (startTime !== null) {
      const elapsed = Date.now() - startTime;
      const timeStr = formatDuration(elapsed);
      const check = ctx.ui.theme.fg("accent", "✓");
      const data = ctx.ui.theme.fg(
        "muted",
        buildLabel(timeStr, throughput.getFinalThroughput()),
      );
      ctx.ui.notify(`${check} ${data}`, "info");
      startTime = null;
    }
    ctx.ui.setWorkingMessage();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    clearLiveInterval();
    startTime = null;
    throughput.reset();
    ctx.ui.setWorkingMessage();
  });
}
