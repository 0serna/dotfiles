import {
  createExtensionLogger,
  type ExtensionLogger,
} from "./shared/logger.js";

import {
  isToolCallEventType,
  type ExtensionAPI,
  type ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

type ChoiceResult =
  | { type: "allow-once" }
  | { type: "allow-session" }
  | { type: "block" };

interface CmdInfo {
  command: string;
  scope: string;
  approvalKey: string;
}

let logger: ExtensionLogger;

const sessionApprovals = new Set<string>();

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

/** Strip single-quoted and double-quoted strings to prevent false positives. */
function preprocess(command: string): string {
  return command.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "");
}

// ---------------------------------------------------------------------------
// Sensitive patterns
// ---------------------------------------------------------------------------

/**
 * Flat array of sensitive command patterns, ordered most-specific-first.
 * Each pattern is tested against the preprocessed command string.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // git push with --delete flag
  /\bgit\s+push\b.*--delete\b/i,
  // git push with --force or -f
  /\bgit\s+push\b.*(?:--force(?:-with-lease)?|\b-f\b)/i,
  // any git push
  /\bgit\s+push\b/i,
  // git reset with --hard
  /\bgit\s+reset\b.*--hard\b/i,
  // git clean with -f or --force
  /\bgit\s+clean\b.*(?:(?:^|\s)-[^\s]*f\b|--force\b)/i,
  // any git rebase
  /\bgit\s+rebase\b/i,
  // git commit with --amend
  /\bgit\s+commit\b.*--amend\b/i,
  // git checkout with -f
  /\bgit\s+checkout\b.*(?:(?:^|\s)-[^\s]*f\b)/i,
  // git switch with --discard-changes
  /\bgit\s+switch\b.*--discard-changes\b/i,
  // git branch with -D or --delete
  /\bgit\s+branch\b.*(?:(?:^|\s)-D\b|--delete\b)/i,
  // git tag with -d or --delete
  /\bgit\s+tag\b.*(?:(?:^|\s)-d\b|--delete\b)/i,
  // gh subcommands
  /\bgh\s+pr\s+(?:create|merge|close|reopen|edit|ready)\b/i,
  /\bgh\s+issue\s+(?:create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock)\b/i,
  /\bgh\s+repo\s+(?:create|delete|archive|unarchive|edit|rename|fork)\b/i,
  /\bgh\s+release\s+(?:create|edit|delete|upload)\b/i,
  /\bgh\s+workflow\s+(?:run|enable|disable)\b/i,
  /\bgh\s+run\s+(?:cancel|delete|rerun)\b/i,
  // gh api mutations (non-GET method or field/input flags)
  /\bgh\s+api\b[\s\S]*?(?:\s(?:-f|-F|--field|--raw-field|--input)\b|(?:\s|^)(?:-X|--method)(?:\s+|=)(?!GET)[A-Za-z]+)/i,
  // sudo
  /\bsudo\b/i,
  // rm -rf targeting /
  /\brm\s+(?=[^;|&]*(?:-[a-z]*r[a-z]*|--recursive))(?=[^;|&]*(?:-[a-z]*f[a-z]*|--force))(?:--?[a-zA-Z]+\s+)*(?:--\s+)?\/(?:\s|$|[;&|`])/i,
  // dd
  /\bdd\b/i,
  // mkfs, fdisk, parted
  /\b(?:mkfs\.\w+|fdisk|parted)\b/i,
  // shutdown, reboot, poweroff, halt
  /\b(?:shutdown|reboot|poweroff|halt)\b/i,
  // chmod/chown 777
  /\b(?:chmod|chown)\s+(?:-[^\s]+\s+)?777\b/i,
  // curl|wget piped to shell
  /\b(?:curl|wget)\b.*\|\s*(?:bash|sh|zsh|fish)\b/i,
  // shell -c invocation
  /\b(?:bash|sh|zsh|fish)\s+-c\s+/i,
];

// ---------------------------------------------------------------------------
// Sensitivity detection
// ---------------------------------------------------------------------------

/**
 * Preprocess the command then check against all sensitive patterns.
 * Returns the first matching pattern, or null if none match.
 */
function findSensitiveMatch(command: string): RegExp | null {
  const cleaned = preprocess(command);
  return SENSITIVE_PATTERNS.find((p) => p.test(cleaned)) ?? null;
}

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

// ---------------------------------------------------------------------------
// Tool call validation and UI interaction
// ---------------------------------------------------------------------------

function getCommandFromEvent(event: ToolCallEvent): string | null {
  if (!isToolCallEventType("bash", event)) return null;
  const command = event.input.command;
  if (typeof command !== "string" || command.trim() === "") return null;
  return command;
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

async function buildCmdInfo(
  command: string,
  cwd: string,
  pi: ExtensionAPI,
): Promise<CmdInfo> {
  const normalizedCommand = normalizeCommand(command);
  const scope = await getApprovalScope(cwd, pi);
  const approvalKey = `${scope}\u0000${normalizedCommand}`;
  return { command, scope, approvalKey };
}

function isSessionApproved(approvalKey: string): boolean {
  return sessionApprovals.has(approvalKey);
}

// ===========================================================================
// UI interaction
// ===========================================================================

async function promptAndHandleChoice(
  ctx: ExtensionContext,
  command: string,
  approvalKey: string,
  scope: string,
): Promise<{ block: true; reason: string } | undefined> {
  logger.log("prompt_shown", { cwd: ctx.cwd, scope, command });

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
      lines.push(theme.fg("text", "Sensitive command"));
      for (const wLine of wrapTextWithAnsi(theme.fg("muted", command), width)) {
        lines.push(wLine);
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
          theme.fg("dim", " ↑↓ navigate • Enter to confirm • Esc to cancel"),
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

  logger.log("user_choice", {
    cwd: ctx.cwd,
    scope,
    choice: choice.type,
    command,
  });

  if (choice.type === "allow-session") {
    sessionApprovals.add(approvalKey);
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

async function handleSensitiveCommand(
  ctx: ExtensionContext,
  command: string,
  approvalKey: string,
  scope: string,
): Promise<{ block: true; reason: string } | undefined> {
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

  return promptAndHandleChoice(ctx, command, approvalKey, scope);
}

async function handleToolCall(
  event: ToolCallEvent,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<{ block: true; reason: string } | { block?: false } | undefined> {
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

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "permissions");
  });

  pi.on("tool_call", (event, ctx) => handleToolCall(event, ctx, pi));
}
