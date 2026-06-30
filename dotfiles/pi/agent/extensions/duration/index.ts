import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  formatDuration,
  inferLastDuration,
  type SessionEntry,
} from "./helpers.ts";

export default function (pi: ExtensionAPI) {
  let startTime: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function clearLiveInterval(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function statusText(ctx: ExtensionContext, ms: number): string {
    return ctx.ui.theme.fg("dim", `⏱ ${formatDuration(ms)}`);
  }

  pi.on("agent_start", (_event, ctx) => {
    startTime = Date.now();
    ctx.ui.setStatus("duration", statusText(ctx, 0));
    clearLiveInterval();
    intervalId = setInterval(() => {
      if (startTime !== null) {
        ctx.ui.setStatus("duration", statusText(ctx, Date.now() - startTime));
      }
    }, 1000);
  });

  pi.on("agent_end", (_event, ctx) => {
    clearLiveInterval();
    if (startTime !== null) {
      const elapsed = Date.now() - startTime;
      ctx.ui.setStatus("duration", statusText(ctx, elapsed));
      startTime = null;
    }
  });

  pi.on("session_shutdown", () => {
    clearLiveInterval();
    startTime = null;
  });

  pi.on("session_start", (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries() as SessionEntry[];
    const inferred = inferLastDuration(entries);
    if (inferred !== null) {
      ctx.ui.setStatus("duration", statusText(ctx, inferred));
    }
  });
}
