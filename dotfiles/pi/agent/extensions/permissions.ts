import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type SensitiveMatch = {
  reason: string;
  segment: string;
};

type ExtensionContext = Parameters<Parameters<ExtensionAPI["on"]>[1]>[1];

interface CmdInfo {
  command: string;
  scope: string;
  approvalKey: string;
}

const sessionApprovals = new Set<string>();
const LOG_FILE = "/tmp/pi-permission-gate.log";

// ---------------------------------------------------------------------------
// Sensitive command rule sets
// ---------------------------------------------------------------------------

const SENSITIVE_GIT_RULES: Array<{
  when: (candidate: string) => boolean;
  reason: string;
}> = [
  {
    when: (c) => /\bgit\s+push\b/i.test(c),
    reason: "git push mutates a remote",
  },
  {
    when: (c) => /\bgit\s+reset\b/i.test(c) && /--hard\b/i.test(c),
    reason: "git reset --hard rewrites the working tree",
  },
  {
    when: (c) =>
      /\bgit\s+clean\b/i.test(c) &&
      /(?:(?:^|\s)-[^\s]*f\b)|(?:--force\b)/i.test(c),
    reason: "git clean with force deletes files",
  },
  {
    when: (c) => /\bgit\s+rebase\b/i.test(c),
    reason: "git rebase rewrites history",
  },
  {
    when: (c) => /\bgit\s+commit\b/i.test(c) && /--amend\b/i.test(c),
    reason: "git commit --amend rewrites history",
  },
  {
    when: (c) => /\bgit\s+checkout\b/i.test(c) && /(?:^|\s)-[^\s]*f\b/i.test(c),
    reason: "git checkout -f discards changes",
  },
  {
    when: (c) =>
      /\bgit\s+switch\b/i.test(c) && /(?:^|\s)--discard-changes\b/i.test(c),
    reason: "git switch --discard-changes discards changes",
  },
  {
    when: (c) =>
      /\bgit\s+branch\b/i.test(c) &&
      /(?:(?:^|\s)-[^\s]*D\b)|(?:(?:^|\s)--delete\b)/i.test(c),
    reason: "git branch delete removes branches",
  },
  {
    when: (c) =>
      /\bgit\s+tag\b/i.test(c) && /(?:^|\s)-d\b|(?:^|\s)--delete\b/i.test(c),
    reason: "git tag delete removes tags",
  },
  {
    when: (c) => /\bgit\s+push\b/i.test(c) && /--delete\b/i.test(c),
    reason: "git push --delete removes remote refs",
  },
  {
    when: (c) =>
      /\bgit\s+push\b/i.test(c) && /--force(?:-with-lease)?\b|-f\b/i.test(c),
    reason: "git push force rewrites remote refs",
  },
];

const SENSITIVE_GH_PATTERNS: Array<{
  test: RegExp;
  reason: string;
}> = [
  {
    test: /\bgh\s+pr\s+(create|merge|close|reopen|edit|ready)\b/i,
    reason: "gh pr modifies pull requests",
  },
  {
    test: /\bgh\s+issue\s+(create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock)\b/i,
    reason: "gh issue modifies issues",
  },
  {
    test: /\bgh\s+repo\s+(create|delete|archive|unarchive|edit|rename|fork)\b/i,
    reason: "gh repo modifies repositories",
  },
  {
    test: /\bgh\s+release\s+(create|edit|delete|upload)\b/i,
    reason: "gh release publishes or deletes releases",
  },
  {
    test: /\bgh\s+workflow\s+(run|enable|disable)\b/i,
    reason: "gh workflow triggers or modifies workflows",
  },
  {
    test: /\bgh\s+run\s+(cancel|delete|rerun)\b/i,
    reason: "gh run modifies runs",
  },
];

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function logEvent(eventName: string, details: Record<string, unknown>): void {
  try {
    appendFileSync(
      LOG_FILE,
      `${new Date().toISOString()} ${eventName} ${JSON.stringify(details)}\n`,
    );
  } catch {
    // Logging must never break command handling.
  }
}

// ---------------------------------------------------------------------------
// Command parsing helpers
// ---------------------------------------------------------------------------

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function splitCommandSegments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||;|\n|&(?!&))/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const STRIP_RE =
  /^(?:env\s+(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)*|(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)+|(?:command|builtin|nice|nohup|time)\s+)/i;

function stripLeadingWrappers(segment: string): string {
  let current = segment.trim();
  let m: RegExpExecArray | null;
  while ((m = STRIP_RE.exec(current)) != null && m[0].length > 0) {
    current = current.slice(m[0].length).trim();
  }
  return current;
}

function extractShellWrappedCommand(segment: string): string | null {
  const wrapped = stripLeadingWrappers(segment);
  const match = wrapped.match(
    /^(?:bash|sh|zsh|fish)\s+(?:-[^\s]*c[^\s]*|-c)\s+(['"])([\s\S]*)\1$/i,
  );
  return match?.[2]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Sensitivity detection
// ---------------------------------------------------------------------------

function isSensitiveGitSegment(segment: string): string | null {
  const candidate = stripLeadingWrappers(segment);
  if (!/^git\b/i.test(candidate)) {
    return null;
  }
  return SENSITIVE_GIT_RULES.find((r) => r.when(candidate))?.reason ?? null;
}

function checkGhMethod(candidate: string): string | null {
  const methodMatch = candidate.match(
    /(?:\s|^)(?:-X|--method)(?:\s+|=)([A-Za-z]+)/i,
  );
  if (methodMatch == null) return null;
  const method = methodMatch[1].toUpperCase();
  return method !== "GET" ? `gh api uses ${method}` : null;
}

function checkGhApi(candidate: string): string | null {
  if (!/\bgh\s+api\b/i.test(candidate)) {
    return null;
  }
  const methodResult = checkGhMethod(candidate);
  if (methodResult != null) return methodResult;
  const sendsPayload = /\s(?:-f|-F|--field|--raw-field|--input)\b/i;
  return sendsPayload.test(candidate)
    ? "gh api sends a mutating payload"
    : null;
}

function isSensitiveGhSegment(segment: string): string | null {
  const candidate = stripLeadingWrappers(segment);
  if (!/^gh\b/i.test(candidate)) {
    return null;
  }
  const fromPatterns = SENSITIVE_GH_PATTERNS.find((p) =>
    p.test.test(candidate),
  )?.reason;
  return fromPatterns ?? checkGhApi(candidate);
}

function checkWrappedSegment(segment: string): SensitiveMatch | null {
  const wrappedCommand = extractShellWrappedCommand(segment);
  if (wrappedCommand == null) return null;
  const nestedMatch = findSensitiveMatch(wrappedCommand);
  return nestedMatch != null ? { reason: nestedMatch.reason, segment } : null;
}

function checkSegment(segment: string): SensitiveMatch | null {
  const gitReason = isSensitiveGitSegment(segment);
  if (gitReason != null) {
    return { reason: gitReason, segment };
  }
  const ghReason = isSensitiveGhSegment(segment);
  if (ghReason != null) {
    return { reason: ghReason, segment };
  }
  return checkWrappedSegment(segment);
}

function findSensitiveMatch(command: string): SensitiveMatch | null {
  for (const segment of splitCommandSegments(command)) {
    const match = checkSegment(segment);
    if (match != null) {
      return match;
    }
  }
  return null;
}

function getApprovalScope(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
    timeout: 500,
    shell: false,
  });
  if (result.error == null && result.status === 0) {
    const repoRoot = (result.stdout as string).trim();
    if (repoRoot !== "") {
      return repoRoot;
    }
  }
  return cwd;
}

// ---------------------------------------------------------------------------
// Tool call validation and UI interaction
// ---------------------------------------------------------------------------

function getCommandFromEvent(event: unknown): string | null {
  if (!isToolCallEventType("bash", event)) return null;
  const command = event.input.command;
  if (typeof command !== "string" || command.trim() === "") return null;
  return command;
}

function buildCmdInfo(command: string, cwd: string): CmdInfo {
  const normalizedCommand = normalizeCommand(command);
  const scope = getApprovalScope(cwd);
  const approvalKey = `${scope}\u0000${normalizedCommand}`;
  return { command, normalizedCommand, scope, approvalKey };
}

function isSessionApproved(approvalKey: string): boolean {
  return sessionApprovals.has(approvalKey);
}

async function promptAndHandleChoice(
  ctx: ExtensionContext,
  sensitiveMatch: SensitiveMatch,
  command: string,
  approvalKey: string,
  scope: string,
): Promise<{ block: true; reason: string } | undefined> {
  const choice = await ctx.ui.select(
    `Allow sensitive command\n\nCommand:\n${command}\n\nReason: ${sensitiveMatch.reason}\nDetected segment: ${sensitiveMatch.segment}`,
    ["Allow once", "Allow for this session", "Block"],
  );
  logEvent("user_choice", {
    cwd: ctx.cwd,
    scope,
    choice: choice ?? "dismissed",
    reason: sensitiveMatch.reason,
    command,
  });
  if (choice === "Allow for this session") {
    sessionApprovals.add(approvalKey);
    logEvent("session_approval_stored", { cwd: ctx.cwd, scope, command });
    return;
  }
  if (choice === "Allow once") {
    return;
  }
  logEvent("blocked_by_user", { cwd: ctx.cwd, scope, command });
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

  logEvent("sensitive_detected", {
    cwd: ctx.cwd,
    scope,
    reason: sensitiveMatch.reason,
    segment: sensitiveMatch.segment,
    command,
  });

  if (!ctx.hasUI) {
    logEvent("blocked_no_ui", { cwd: ctx.cwd, scope, command });
    return {
      block: true,
      reason: "Sensitive command blocked (no UI for confirmation)",
    };
  }

  return promptAndHandleChoice(
    ctx,
    sensitiveMatch,
    command,
    approvalKey,
    scope,
  );
}

async function handleToolCall(
  event: unknown,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | { block?: false } | undefined> {
  const command = getCommandFromEvent(event);
  if (command == null) return;

  const { scope, approvalKey } = buildCmdInfo(command, ctx.cwd);

  if (isSessionApproved(approvalKey)) {
    logEvent("session_approval_reused", { cwd: ctx.cwd, scope, command });
    return;
  }

  return handleSensitiveCommand(ctx, command, approvalKey, scope);
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", handleToolCall);
}
