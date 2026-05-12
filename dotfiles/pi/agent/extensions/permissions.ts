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

const sessionApprovals = new Set<string>();
const LOG_FILE = "/tmp/pi-permission-gate.log";

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

function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function splitCommandSegments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||;|\n|&(?!&))/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function stripLeadingWrappers(segment: string): string {
  let current = segment.trim();

  while (true) {
    const envPrefixMatch = current.match(
      /^env\s+(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)*/i,
    );
    if (envPrefixMatch?.[0] != null && envPrefixMatch[0].length > 0) {
      current = current.slice(envPrefixMatch[0].length).trim();
      continue;
    }

    const assignmentMatch = current.match(
      /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)*/,
    );
    if (assignmentMatch?.[0] != null && assignmentMatch[0].length > 0) {
      current = current.slice(assignmentMatch[0].length).trim();
      continue;
    }

    const wrapperMatch = current.match(
      /^(?:command|builtin|nice|nohup|time)\s+/i,
    );
    if (wrapperMatch?.[0] != null) {
      current = current.slice(wrapperMatch[0].length).trim();
      continue;
    }

    break;
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

function isSensitiveGitSegment(segment: string): string | null {
  const candidate = stripLeadingWrappers(segment);
  if (!/^git\b/i.test(candidate)) {
    return null;
  }

  if (/\bgit\s+push\b/i.test(candidate)) {
    return "git push mutates a remote";
  }

  if (/\bgit\s+reset\b/i.test(candidate) && /--hard\b/i.test(candidate)) {
    return "git reset --hard rewrites the working tree";
  }

  if (
    /\bgit\s+clean\b/i.test(candidate) &&
    /(?:(?:^|\s)-[^\s]*f\b)|(?:--force\b)/i.test(candidate)
  ) {
    return "git clean with force deletes files";
  }

  if (/\bgit\s+rebase\b/i.test(candidate)) {
    return "git rebase rewrites history";
  }

  if (/\bgit\s+commit\b/i.test(candidate) && /--amend\b/i.test(candidate)) {
    return "git commit --amend rewrites history";
  }

  if (
    /\bgit\s+checkout\b/i.test(candidate) &&
    /(?:^|\s)-[^\s]*f\b/i.test(candidate)
  ) {
    return "git checkout -f discards changes";
  }

  if (
    /\bgit\s+switch\b/i.test(candidate) &&
    /(?:^|\s)--discard-changes\b/i.test(candidate)
  ) {
    return "git switch --discard-changes discards changes";
  }

  if (
    /\bgit\s+branch\b/i.test(candidate) &&
    /(?:(?:^|\s)-[^\s]*D\b)|(?:(?:^|\s)--delete\b)/i.test(candidate)
  ) {
    return "git branch delete removes branches";
  }

  if (
    /\bgit\s+tag\b/i.test(candidate) &&
    /(?:^|\s)-d\b|(?:^|\s)--delete\b/i.test(candidate)
  ) {
    return "git tag delete removes tags";
  }

  if (/\bgit\s+push\b/i.test(candidate) && /--delete\b/i.test(candidate)) {
    return "git push --delete removes remote refs";
  }

  if (
    /\bgit\s+push\b/i.test(candidate) &&
    /--force(?:-with-lease)?\b|-f\b/i.test(candidate)
  ) {
    return "git push force rewrites remote refs";
  }

  return null;
}

function isSensitiveGhSegment(segment: string): string | null {
  const candidate = stripLeadingWrappers(segment);
  if (!/^gh\b/i.test(candidate)) {
    return null;
  }

  if (/\bgh\s+pr\s+(create|merge|close|reopen|edit|ready)\b/i.test(candidate)) {
    return "gh pr modifies pull requests";
  }

  if (
    /\bgh\s+issue\s+(create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock)\b/i.test(
      candidate,
    )
  ) {
    return "gh issue modifies issues";
  }

  if (
    /\bgh\s+repo\s+(create|delete|archive|unarchive|edit|rename|fork)\b/i.test(
      candidate,
    )
  ) {
    return "gh repo modifies repositories";
  }

  if (/\bgh\s+release\s+(create|edit|delete|upload)\b/i.test(candidate)) {
    return "gh release publishes or deletes releases";
  }

  if (/\bgh\s+workflow\s+(run|enable|disable)\b/i.test(candidate)) {
    return "gh workflow triggers or modifies workflows";
  }

  if (/\bgh\s+run\s+(cancel|delete|rerun)\b/i.test(candidate)) {
    return "gh run modifies runs";
  }

  if (/\bgh\s+api\b/i.test(candidate)) {
    const methodMatch = candidate.match(
      /(?:\s|^)(?:-X|--method)(?:\s+|=)([A-Za-z]+)/i,
    );
    const method = methodMatch?.[1]?.toUpperCase();
    if (method != null && method !== "GET") {
      return `gh api uses ${method}`;
    }

    if (/\s(?:-f|-F|--field|--raw-field|--input)\b/i.test(candidate)) {
      return "gh api sends a mutating payload";
    }
  }

  return null;
}

function findSensitiveMatch(command: string): SensitiveMatch | null {
  for (const segment of splitCommandSegments(command)) {
    const gitReason = isSensitiveGitSegment(segment);
    if (gitReason != null) {
      return { reason: gitReason, segment };
    }

    const ghReason = isSensitiveGhSegment(segment);
    if (ghReason != null) {
      return { reason: ghReason, segment };
    }

    const wrappedCommand = extractShellWrappedCommand(segment);
    if (wrappedCommand != null) {
      const nestedMatch = findSensitiveMatch(wrappedCommand);
      if (nestedMatch != null) {
        return { reason: nestedMatch.reason, segment };
      }
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
    const repoRoot = (result.stdout ?? "").trim();
    if (repoRoot !== "") {
      return repoRoot;
    }
  }

  return cwd;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) {
      return;
    }

    const command = event.input.command;
    if (typeof command !== "string" || command.trim() === "") {
      return;
    }

    const normalizedCommand = normalizeCommand(command);
    const approvalScope = getApprovalScope(ctx.cwd);
    const approvalKey = `${approvalScope}\u0000${normalizedCommand}`;
    if (sessionApprovals.has(approvalKey)) {
      logEvent("session_approval_reused", {
        cwd: ctx.cwd,
        scope: approvalScope,
        command,
      });
      return;
    }

    const sensitiveMatch = findSensitiveMatch(command);
    if (sensitiveMatch == null) {
      return;
    }

    logEvent("sensitive_detected", {
      cwd: ctx.cwd,
      scope: approvalScope,
      reason: sensitiveMatch.reason,
      segment: sensitiveMatch.segment,
      command,
    });

    if (!ctx.hasUI) {
      logEvent("blocked_no_ui", {
        cwd: ctx.cwd,
        scope: approvalScope,
        reason: sensitiveMatch.reason,
        command,
      });
      return {
        block: true,
        reason: "Sensitive command blocked (no UI for confirmation)",
      };
    }

    const choice = await ctx.ui.select(
      `Allow sensitive command\n\nCommand:\n${command}\n\nReason: ${sensitiveMatch.reason}\nDetected segment: ${sensitiveMatch.segment}`,
      ["Allow once", "Allow for this session", "Block"],
    );

    logEvent("user_choice", {
      cwd: ctx.cwd,
      scope: approvalScope,
      choice: choice ?? "dismissed",
      reason: sensitiveMatch.reason,
      command,
    });

    if (choice === "Allow for this session") {
      sessionApprovals.add(approvalKey);
      logEvent("session_approval_stored", {
        cwd: ctx.cwd,
        scope: approvalScope,
        command,
      });
      return;
    }

    if (choice === "Allow once") {
      return;
    }

    logEvent("blocked_by_user", {
      cwd: ctx.cwd,
      scope: approvalScope,
      reason: sensitiveMatch.reason,
      command,
    });

    return {
      block: true,
      reason: `Blocked by user: ${sensitiveMatch.reason}`,
    };
  });
}
