import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { log } from "./shared/logger.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSECUTIVE_FAILURE_THRESHOLD = 2;
const BLOCKAGE_MESSAGE =
  "You've had repeated failures. Call `advisor` for guidance.";
const KEYWORDS = ["opsx-propose", "opsx-apply"];
const FOLLOWUP_MESSAGE = "Call `advisor` to review the work before finishing.";

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Combined regex for short flags, redirections, and dot-references. */
const IGNORED_TOKEN_RE = /^(?:-[a-zA-Z0-9]+|\d*[>&|<>]+|\.\.?)$/;

/** Returns true for tokens that should be stripped from the command signature. */
function isIgnoredToken(token: string): boolean {
  if (token.includes("/")) return true;
  return IGNORED_TOKEN_RE.test(token);
}

/**
 * Strip `--flag value` pairs (flags without `=`) from the token list.
 * The paired value is consumed so it won't appear in the result.
 */
function skipFlagValues(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as string;
    if (token.startsWith("--") && !token.includes("=")) {
      i++;
      continue;
    }
    result.push(token);
  }
  return result;
}

function normalizeCommand(command: string): string {
  const tokens = command
    .split(/[|&;]{1,2}/)[0]
    .trim()
    .split(/\s+/);
  return skipFlagValues(tokens)
    .filter((t) => !isIgnoredToken(t))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Module-level state (reset per episode)
// ---------------------------------------------------------------------------

let lastNormalizedCommand = "";
let consecutiveFailures = 0;
let blockageSteerSent = false;
let keywordDetected = false;
let sessionId = "";

// ---------------------------------------------------------------------------
// Tool-result helpers
// ---------------------------------------------------------------------------

function getExitCode(
  details: { exitCode?: number } | undefined,
  isError: boolean | undefined,
): number {
  return details?.exitCode ?? (isError ? 1 : 0);
}

function updateFailureState(normalized: string, exitCode: number): void {
  if (exitCode !== 0) {
    if (normalized !== "" && normalized === lastNormalizedCommand) {
      consecutiveFailures++;
    } else {
      lastNormalizedCommand = normalized;
      consecutiveFailures = 1;
    }
  } else {
    lastNormalizedCommand = "";
    consecutiveFailures = 0;
  }
}

function handleBashToolResult(event: {
  details?: { exitCode?: number };
  isError?: boolean;
  input?: { command?: string };
}): void {
  const exitCode = getExitCode(event.details, event.isError);
  const normalized = normalizeCommand(event.input?.command ?? "");
  updateFailureState(normalized, exitCode);
}

function handleAdvisorToolResult(): void {
  log("advisor-hints", "advisor", {
    sessionId,
    hadBlockageSteer: blockageSteerSent,
  });
  lastNormalizedCommand = "";
  consecutiveFailures = 0;
  blockageSteerSent = false;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    lastNormalizedCommand = "";
    consecutiveFailures = 0;
    blockageSteerSent = false;
    keywordDetected = false;

    const sessionFile = ctx.sessionManager.getSessionFile();
    const basename = (sessionFile ?? "").split("/").pop() ?? "";
    const name = basename.replace(/\.jsonl$/, "");
    const parts = name.split("_");
    sessionId = parts.length >= 2 ? parts.slice(1).join("_") : name;
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return;

    keywordDetected = false;

    for (const kw of KEYWORDS) {
      if (event.text.includes(kw)) {
        keywordDetected = true;
        log("advisor-hints", "keyword-match", { sessionId, keyword: kw });
        break;
      }
    }
  });

  pi.on("agent_start", async () => {
    lastNormalizedCommand = "";
    consecutiveFailures = 0;
    blockageSteerSent = false;
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName === "bash") {
      handleBashToolResult(event);
    }

    if (event.toolName === "advisor") {
      handleAdvisorToolResult();
    }
  });

  pi.on("turn_end", async () => {
    if (blockageSteerSent) return;

    if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      pi.sendMessage(
        {
          customType: "advisor-blockage",
          content: BLOCKAGE_MESSAGE,
          display: true,
        },
        { deliverAs: "steer" },
      );
      blockageSteerSent = true;
      log("advisor-hints", "blockage", {
        sessionId,
        command: lastNormalizedCommand,
        failureCount: consecutiveFailures,
      });
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (keywordDetected) {
      keywordDetected = false;
      log("advisor-hints", "followup-sent", { sessionId });

      const sendWhenIdle = (): void => {
        if (ctx.isIdle()) {
          pi.sendUserMessage(FOLLOWUP_MESSAGE);
        } else {
          setTimeout(sendWhenIdle, 5);
        }
      };
      setTimeout(sendWhenIdle, 0);
    }
  });
}
