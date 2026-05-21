import {
  isToolCallEventType,
  type ExtensionAPI,
  type ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

import type { CmdInfo } from "./types.ts";

const sessionApprovals = new Set<string>();

async function getApprovalScope(
  cwd: string,
  pi: ExtensionAPI,
): Promise<string> {
  try {
    const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      timeout: 500,
    });
    if (result.code === 0) {
      const repoRoot = result.stdout.trim();
      if (repoRoot !== "") {
        return repoRoot;
      }
    }
  } catch {
    // Fall through to cwd return
  }
  return cwd;
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

export function getCommandFromEvent(event: ToolCallEvent): string | null {
  if (!isToolCallEventType("bash", event)) return null;
  const command = event.input.command;
  if (typeof command !== "string" || command.trim() === "") return null;
  return command;
}

export async function buildCmdInfo(
  command: string,
  cwd: string,
  pi: ExtensionAPI,
): Promise<CmdInfo> {
  const normalizedCommand = normalizeCommand(command);
  const scope = await getApprovalScope(cwd, pi);
  const approvalKey = `${scope}\u0000${normalizedCommand}`;
  return { command, scope, approvalKey };
}

export function isSessionApproved(approvalKey: string): boolean {
  return sessionApprovals.has(approvalKey);
}

export function approveForSession(approvalKey: string): void {
  sessionApprovals.add(approvalKey);
}
