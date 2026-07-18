import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

function notify(
  ctx: ExtensionCommandContext,
  message: string,
  level: "info" | "warning" | "error",
): void {
  if (ctx.hasUI) ctx.ui.notify(message, level);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("rename", {
    description: "Rename the session with the given text",
    handler: async (args, ctx) => {
      const title = args.trim();

      if (!title) {
        notify(ctx, "Usage: /rename <session name>", "warning");
        return;
      }

      pi.setSessionName(title);
      notify(ctx, `Session renamed: "${title}"`, "info");
    },
  });
}
