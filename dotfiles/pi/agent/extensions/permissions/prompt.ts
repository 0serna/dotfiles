import type { ExtensionLogger } from "../shared/logger.ts";

import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import { approveForSession } from "./approvals.ts";
import type { BlockResult, ChoiceResult, ExtensionContext } from "./types.ts";

export async function promptForSensitiveCommand(
  ctx: ExtensionContext,
  logger: ExtensionLogger,
  command: string,
  approvalKey: string,
  scope: string,
): Promise<BlockResult | undefined> {
  logger.log("approval_prompt_shown", { cwd: ctx.cwd, scope, command });

  const choice = await ctx.ui.custom<ChoiceResult>((tui, theme, _kb, done) => {
    const state = { optionIndex: 0 };
    let cachedLines: string[] | undefined;

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function buildRenderLines(width: number): string[] {
      const optionLabels = ["Allow once", "Allow for this session", "Block"];
      const lines: string[] = [];
      lines.push(theme.fg("accent", "─".repeat(width)));
      lines.push(theme.fg("text", "Sensitive command requires approval"));
      for (const line of wrapTextWithAnsi(theme.fg("muted", command), width)) {
        lines.push(line);
      }
      lines.push("");
      for (let i = 0; i < optionLabels.length; i++) {
        const prefix =
          i === state.optionIndex
            ? theme.fg("accent", `> ${i + 1}. ${optionLabels[i]}`)
            : `  ${i + 1}. ${optionLabels[i]}`;
        lines.push(truncateToWidth(prefix, width));
      }
      lines.push("");
      lines.push(
        truncateToWidth(
          theme.fg("dim", " ↑↓ navigate • Enter confirm • Esc block"),
          width,
        ),
      );
      lines.push(theme.fg("accent", "─".repeat(width)));
      return lines;
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      cachedLines = buildRenderLines(width);
      return cachedLines;
    }

    function handleNavigation(data: string): boolean {
      if (matchesKey(data, Key.up)) {
        state.optionIndex = Math.max(0, state.optionIndex - 1);
        return true;
      }
      if (matchesKey(data, Key.down)) {
        state.optionIndex = Math.min(2, state.optionIndex + 1);
        return true;
      }
      return false;
    }

    function commitChoice(): void {
      if (state.optionIndex === 0) done({ type: "allow-once" });
      else if (state.optionIndex === 1) done({ type: "allow-session" });
      else done({ type: "block" });
    }

    function handleAction(data: string): boolean {
      if (matchesKey(data, Key.enter)) {
        commitChoice();
        return true;
      }
      if (matchesKey(data, Key.escape)) {
        done({ type: "block" });
        return true;
      }
      return false;
    }

    function handleInput(data: string) {
      if (handleNavigation(data)) {
        refresh();
        return;
      }
      handleAction(data);
    }
  });

  logger.log("approval_choice", {
    cwd: ctx.cwd,
    scope,
    choice: choice.type,
    command,
  });

  if (choice.type === "allow-session") {
    approveForSession(approvalKey);
    logger.log("session_approval_stored", {
      cwd: ctx.cwd,
      scope,
      command,
    });
    return;
  }
  if (choice.type === "allow-once") {
    return;
  }
  logger.log("blocked_by_user", { cwd: ctx.cwd, scope, command });
  return { block: true, reason: "Blocked by user" };
}
