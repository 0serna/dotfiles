import {
  createLocalBashOperations,
  isToolCallEventType,
  type BashOperations,
  type BashResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { spawnSync } from "child_process";
import { appendFileSync } from "fs";

/**
 * RTK Rewrite Extension for Pi
 *
 * Intercepts bash commands and rewrites them using `rtk rewrite` for token savings.
 * - Exit 0: rewrite found → replace command
 * - Exit 1: no RTK equivalent → execute original
 * - Exit 2: deny rule matched → execute original
 * - Exit 3: ask rule matched → rewrite and auto-allow
 */

const DEBUG = true;
const DEBUG_LOG = "/tmp/pi-rtk-rewrite.log";

type RewriteResult = {
  rewritten: string;
  exitCode: number;
  stderr: string;
};

type RewriteOutcome =
  | { kind: "rewritten"; command: string }
  | { kind: "original" }
  | { kind: "error" };

type CompoundPart = {
  command: string;
  operator?: "&&" | "||";
};

function debugLog(message: string): void {
  if (!DEBUG) {
    return;
  }

  appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${message}\n`);
}

function shouldUseRewrite(command: string, result: RewriteResult): boolean {
  return (
    (result.exitCode === 0 || result.exitCode === 3) &&
    result.rewritten.length > 0 &&
    result.rewritten !== command
  );
}

function hasUnsupportedSyntax(command: string): boolean {
  return (
    command.includes("\n") ||
    command.includes("$") ||
    command.includes("`") ||
    /[()]/.test(command)
  );
}

function isCompoundOperator(
  char: string,
  next: string | undefined,
): char is "&" | "|" {
  return (char === "&" && next === "&") || (char === "|" && next === "|");
}

// fallow-ignore-next-line complexity
function parseCompoundCommand(command: string): CompoundPart[] | null {
  if (hasUnsupportedSyntax(command)) {
    return null;
  }

  const parts: CompoundPart[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    const next = command[i + 1];

    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      current += char;
      escaped = true;
    } else if (quote !== null) {
      current += char;
      if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      current += char;
      quote = char;
    } else if (isCompoundOperator(char, next)) {
      const trimmed = current.trim();
      if (trimmed === "") {
        return null;
      }

      parts.push({
        command: trimmed,
        operator: `${char}${next}` as "&&" | "||",
      });
      current = "";
      i += 1;
    } else if (char === "|" || char === ";" || char === ">" || char === "<") {
      return null;
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (quote !== null || escaped || trimmed === "") {
    return null;
  }

  if (parts.length === 0) {
    return [{ command: trimmed }];
  }

  parts.push({ command: trimmed });
  return parts;
}

// fallow-ignore-next-line complexity
function rewriteSimpleCommand(command: string): RewriteResult | null {
  debugLog(`rewrite input=${JSON.stringify(command)}`);

  const result = spawnSync("rtk", ["rewrite", command], {
    encoding: "utf8",
    timeout: 1000,
    shell: false,
  });

  if (result.error) {
    debugLog(`rewrite error=${result.error.message}`);
    return null;
  }

  const rewriteResult = {
    rewritten: (result.stdout ?? "").trim(),
    exitCode: result.status ?? 1,
    stderr: (result.stderr ?? "").trim(),
  };

  debugLog(`rewrite result=${JSON.stringify(rewriteResult)}`);
  return rewriteResult;
}

// fallow-ignore-next-line complexity
function rewriteCommand(command: string): RewriteOutcome {
  const parts = parseCompoundCommand(command);
  if (parts === null) {
    debugLog(
      `rewrite skipped reason=unsupported-syntax input=${JSON.stringify(command)}`,
    );
    return { kind: "original" };
  }

  const rewrittenParts: string[] = [];
  let changed = false;

  for (const part of parts) {
    const result = rewriteSimpleCommand(part.command);
    if (result === null) {
      debugLog(`rewrite aborted reason=error input=${JSON.stringify(command)}`);
      return { kind: "error" };
    }

    const rewrittenCommand = shouldUseRewrite(part.command, result)
      ? result.rewritten
      : part.command;
    changed ||= rewrittenCommand !== part.command;
    rewrittenParts.push(rewrittenCommand);

    if (part.operator) {
      rewrittenParts.push(part.operator);
    }
  }

  if (!changed) {
    return { kind: "original" };
  }

  return { kind: "rewritten", command: rewrittenParts.join(" ") };
}

// fallow-ignore-next-line complexity
function getRewrittenCommand(
  source: string,
  command: string | undefined,
): string | null {
  if (!command || command.trim() === "") {
    return null;
  }

  const result = rewriteCommand(command);
  if (result.kind !== "rewritten") {
    if (result.kind === "error") {
      debugLog(`${source} no result; original=${JSON.stringify(command)}`);
    }
    return null;
  }

  debugLog(
    `${source} rewrite ${JSON.stringify(command)} -> ${JSON.stringify(result.command)}`,
  );
  return result.command;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    debugLog("extension loaded");
  });

  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) {
      return;
    }

    const rewrittenCommand = getRewrittenCommand(
      "tool_call",
      event.input.command,
    );
    if (rewrittenCommand == null) {
      return;
    }

    event.input.command = rewrittenCommand;
  });

  pi.on("user_bash", async (event) => {
    const rewrittenCommand = getRewrittenCommand("user_bash", event.command);
    if (rewrittenCommand == null) {
      return;
    }

    const local = createLocalBashOperations();

    return {
      operations: {
        exec(_cmd: string, cwd: string, options: unknown): BashResult {
          return local.exec(
            rewrittenCommand,
            cwd,
            options as Parameters<typeof local.exec>[2],
          );
        },
      } as BashOperations,
    };
  });
}
