import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { formatDuration } from "./format.ts";

export default function (pi: ExtensionAPI) {
  let startTime: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function setWorkingTime(ctx: ExtensionContext, ms: number): void {
    ctx.ui.setWorkingMessage(
      ctx.ui.theme.fg("muted", `Working ${formatDuration(ms)}`),
    );
  }

  pi.on("agent_start", (_event, ctx) => {
    startTime = Date.now();
    clearLiveInterval();
    ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "▸")] });
    setWorkingTime(ctx, 0);
    intervalId = setInterval(() => {
      if (startTime !== null) {
        setWorkingTime(ctx, Date.now() - startTime);
      }
    }, 1000);
  });

  pi.on("agent_end", (_event, ctx) => {
    clearLiveInterval();
    if (startTime !== null) {
      const elapsed = Date.now() - startTime;
      ctx.ui.notify(`Completed in ${formatDuration(elapsed)}`, "info");
      startTime = null;
    }
    ctx.ui.setWorkingMessage();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    clearLiveInterval();
    startTime = null;
    ctx.ui.setWorkingMessage();
  });
}
