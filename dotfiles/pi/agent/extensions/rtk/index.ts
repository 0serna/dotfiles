import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const REWRITE_TIMEOUT_MS = 2_000;

async function rewriteCommand(
  pi: ExtensionAPI,
  command: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await pi.exec("rtk", ["rewrite", command], {
    signal,
    timeout: REWRITE_TIMEOUT_MS,
  });

  if (result.killed) return null;
  if (result.code !== 0 && result.code !== 3) return null;

  return result.stdout.trim() || null;
}

export default async function (pi: ExtensionAPI) {
  const version = await pi.exec("rtk", ["--version"], {
    timeout: REWRITE_TIMEOUT_MS,
  });

  if (version.killed || version.code !== 0) {
    console.warn("[rtk] rtk binary not found in PATH — extension disabled");
    return;
  }

  pi.on("tool_call", async (event, ctx) => {
    try {
      if (!isToolCallEventType("bash", event)) return;

      const command = event.input.command;
      if (typeof command !== "string" || command.trim() === "") return;
      if (command.startsWith("rtk ")) return;
      if (process.env.RTK_DISABLED === "1") return;

      const rewritten = await rewriteCommand(pi, command, ctx.signal);
      if (rewritten && rewritten !== command) {
        event.input.command = rewritten;
      }
    } catch (error) {
      console.warn(
        "[rtk] unexpected error in tool_call handler; passing through command",
        error,
      );
    }
  });
}
