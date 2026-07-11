import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { formatDuration } from "./format.ts";
import { ThroughputTracker, isOutputDeltaEvent } from "./throughput.ts";

export default function (pi: ExtensionAPI) {
  let startTime: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const throughput = new ThroughputTracker();

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function updateWorkingMessage(ctx: ExtensionContext): void {
    if (startTime === null) return;
    const elapsed = Date.now() - startTime;
    const display = throughput.getDisplay() ?? "- tok/s";
    ctx.ui.setWorkingMessage(
      ctx.ui.theme.fg(
        "muted",
        `Working ${formatDuration(elapsed)} | ${display}`,
      ),
    );
  }

  pi.on("agent_start", (_event, ctx) => {
    startTime = Date.now();
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
      const final = throughput.getFinalThroughput();
      const details = final ? ` | ${final}` : "";
      ctx.ui.notify(
        `Completed in ${formatDuration(elapsed)}${details}`,
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
