import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let compacting = false;

  pi.on("session_before_compact", () => {
    compacting = true;
  });
  pi.on("session_compact", () => {
    compacting = false;
  });
  pi.on("session_compact_failed", () => {
    compacting = false;
  });

  pi.on("context", (event, ctx) => {
    const tokens = ctx.getContextUsage()?.tokens;
    if (compacting || tokens == null) return;

    return {
      messages: [
        ...event.messages,
        {
          role: "user" as const,
          content: `status: ${tokens}`,
          timestamp: Date.now(),
        },
      ],
    };
  });
}
