import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";

import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { createKetchRunner } from "./ketch.js";
import { createToolDefinitions } from "./tools.js";

export default async function web(pi: ExtensionAPI) {
  let logger: ExtensionLogger | undefined;

  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "web");
  });

  let available: boolean;
  try {
    const probe = await pi.exec("ketch", ["version"], { cwd: homedir() });
    available = probe.code === 0;
  } catch {
    available = false;
  }

  if (!available) {
    pi.on("session_start", (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "Ketch is unavailable; install it and reload Pi to enable web tools.",
          "warning",
        );
      }
    });
    return;
  }

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
}
