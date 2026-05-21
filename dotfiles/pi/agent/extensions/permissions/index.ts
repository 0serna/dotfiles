import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.ts";

import type {
  ExtensionAPI,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

import {
  buildCmdInfo,
  getCommandFromEvent,
  isSessionApproved,
} from "./approvals.ts";
import { findSensitiveMatch } from "./patterns.ts";
import { promptForSensitiveCommand } from "./prompt.ts";
import type { BlockResult, ExtensionContext } from "./types.ts";

let logger: ExtensionLogger;

async function handleSensitiveCommand(
  ctx: ExtensionContext,
  command: string,
  approvalKey: string,
  scope: string,
): Promise<BlockResult | undefined> {
  const sensitiveMatch = findSensitiveMatch(command);
  if (sensitiveMatch == null) return;

  logger.log("sensitive_detected", { cwd: ctx.cwd, scope, command });

  if (!ctx.hasUI) {
    logger.log("blocked_no_ui", { cwd: ctx.cwd, scope, command });
    return {
      block: true,
      reason: "Sensitive command blocked (no UI for confirmation)",
    };
  }

  return promptForSensitiveCommand(ctx, logger, command, approvalKey, scope);
}

async function handleToolCall(
  event: ToolCallEvent,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<BlockResult | { block?: false } | undefined> {
  const command = getCommandFromEvent(event);
  if (command == null) return;

  const { scope, approvalKey } = await buildCmdInfo(command, ctx.cwd, pi);

  if (isSessionApproved(approvalKey)) {
    logger.log("session_approval_reused", {
      cwd: ctx.cwd,
      scope,
      command,
    });
    return;
  }

  return handleSensitiveCommand(ctx, command, approvalKey, scope);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "permissions");
  });

  pi.on("tool_call", (event, ctx) => handleToolCall(event, ctx, pi));
}
