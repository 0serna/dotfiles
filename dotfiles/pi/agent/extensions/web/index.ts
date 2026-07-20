import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";

import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { createKetchRunner } from "./ketch.js";
import { createToolDefinitions } from "./tools.js";

export default function web(pi: ExtensionAPI) {
  let logger: ExtensionLogger | undefined;
  let registered = false;

  pi.on("session_start", async (_event, ctx) => {
    logger = createExtensionLogger(ctx, "web");

    let available = false;
    try {
      const probe = await pi.exec("ketch", ["version"], { cwd: homedir() });
      available = probe.code === 0;
    } catch {
      // Ketch not installed or not executable.
    }

    if (!available) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "Ketch is unavailable; install it and reload Pi to enable web tools.",
          "warning",
        );
      }
      return;
    }

    if (registered) return; // Idempotent across /reload.
    registered = true;

    const runner = createKetchRunner({
      async exec(command, args, options) {
        const result = await pi.exec(command, args, options);
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.code ?? 1,
          killed: result.killed,
        };
      },
      getLogger: () => logger,
    });

    const [search, fetch, code, docs] = createToolDefinitions(runner);
    pi.registerTool(search);
    pi.registerTool(fetch);
    pi.registerTool(code);
    pi.registerTool(docs);
  });
}
