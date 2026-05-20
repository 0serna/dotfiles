import {
  createBashTool,
  createLocalBashOperations,
  isToolCallEventType,
  type BashOperations,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { spawnSync } from "child_process";

const VALID_RTK_EXITS = [0, 3];

function rtkRewriteCommand(command: string): string | null {
  const result = spawnSync("rtk", ["rewrite", command], {
    encoding: "utf8",
    timeout: 3000,
    shell: false,
  });

  if (result.error) return null;
  if (!result.stdout) return null;
  if (result.status == null) return null;
  if (!VALID_RTK_EXITS.includes(result.status)) return null;

  return result.stdout.trim();
}

export default function (pi: ExtensionAPI) {
  // Agent-initiated: register bash tool for proper tool discovery
  const cwd = process.cwd();
  const bashTool = createBashTool(cwd);
  pi.registerTool(bashTool);

  // Rewrite before bash tool applies commandPrefix
  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return;

    const rewritten = rtkRewriteCommand(event.input.command);
    if (rewritten) {
      event.input.command = rewritten;
    }
  });

  // User-initiated: intercept ! commands (!! bypasses via excludeFromContext)
  pi.on("user_bash", async (event) => {
    if (event.excludeFromContext) return;

    const local = createLocalBashOperations();
    return {
      operations: {
        exec(_cmd: string, cwd: string, options: unknown) {
          const rewritten = rtkRewriteCommand(_cmd) ?? _cmd;
          return local.exec(
            rewritten,
            cwd,
            options as Parameters<typeof local.exec>[2],
          );
        },
      } as BashOperations,
    };
  });
}
