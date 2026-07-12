import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { formatDuration } from "./format.ts";
import { ThroughputTracker, isOutputDeltaEvent } from "./throughput.ts";

export default function (pi: ExtensionAPI) {
  let startTime: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let modelLabel = "";
  const throughput = new ThroughputTracker();

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function buildLabel(timeStr: string, tokPerSec: string | null): string {
    const value = tokPerSec?.replace(/ tok\/s$/, "") ?? "-";
    return `(model: ${modelLabel}, time: ${timeStr}, tok/s: ${value})`;
  }

  function updateWorkingMessage(ctx: ExtensionContext): void {
    if (startTime === null) return;
    const elapsed = Date.now() - startTime;
    const timeStr = formatDuration(elapsed);
    ctx.ui.setWorkingMessage(
      ctx.ui.theme.fg(
        "muted",
        `Working ${buildLabel(timeStr, throughput.getDisplay())}`,
      ),
    );
  }

  pi.on("agent_start", (_event, ctx) => {
    startTime = Date.now();
    modelLabel = ctx.model?.name ?? ctx.model?.id ?? "unknown";
    clearLiveInterval();
    throughput.reset();
    ctx.ui.setWorkingIndicator({
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"].map((f) =>
        ctx.ui.theme.fg("accent", f),
      ),
      intervalMs: 80,
    });
    updateWorkingMessage(ctx);
    intervalId = setInterval(() => updateWorkingMessage(ctx), 1000);
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
      ctx.ui.notify(
        `Completed ${buildLabel(timeStr, throughput.getFinalThroughput())}`,
        "info",
      );
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
