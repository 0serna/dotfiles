import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tool call count that triggers a hint at each turn_end multiple. */
const TOOL_CALL_THRESHOLD = 10;

/** Tools that count toward the threshold. */
const COUNTED_TOOLS = new Set(["bash", "read", "edit", "write"]);

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_FILE = `${process.env.HOME}/.local/state/pi/advisor-hints.log`;

const MAX_LOG_LINES = 2000;

function logEvent(eventName: string, details: Record<string, unknown>): void {
  const line = `${new Date().toISOString()} ${eventName} ${JSON.stringify(details)}\n`;
  try {
    appendFileSync(LOG_FILE, line);
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.split("\n");
    if (lines.length > MAX_LOG_LINES) {
      writeFileSync(LOG_FILE, lines.slice(-MAX_LOG_LINES).join("\n"));
    }
  } catch {
    // Logging must never break the extension.
  }
}

// ---------------------------------------------------------------------------
// Hint texts
// ---------------------------------------------------------------------------

const HINT_TEXT_FIRST =
  "If you're having difficulty, consider using the `advisor` tool now. Otherwise, if this work is important or worth validating before you respond to the user, consider using `advisor` before you finish. If the task is simple and doesn't need review, you can skip it.";

const PASSIVE_GUIDELINE =
  "If this work ends up being important or worth validating before you respond, consider using the `advisor` tool.";

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}

function buildTurnHintText(hintsSinceAdvisor: number): string {
  if (hintsSinceAdvisor <= 1) return HINT_TEXT_FIRST;
  return (
    `This is the ${hintsSinceAdvisor}${ordinalSuffix(hintsSinceAdvisor)} advisor suggestion for this task. ` +
    "If you're having difficulty, consider using the `advisor` tool now. Otherwise, if this work is important or worth validating before you respond, consider using `advisor` before you finish."
  );
}

// ---------------------------------------------------------------------------
// Module-level state (reset per session)
// ---------------------------------------------------------------------------

let toolCalls = 0;
let nextHintAt = TOOL_CALL_THRESHOLD;
let advisorCalledThisTurn = false;
let hintsSinceAdvisor = 0;
let sessionId = "";

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function resetHintProgress(): void {
  toolCalls = 0;
  nextHintAt = TOOL_CALL_THRESHOLD;
  hintsSinceAdvisor = 0;
}

function resetAllState(): void {
  resetHintProgress();
  advisorCalledThisTurn = false;
  sessionId = "";
}

// ---------------------------------------------------------------------------
// Hint injection
// ---------------------------------------------------------------------------

function injectTurnHint(pi: ExtensionAPI, ctx: ExtensionContext): void {
  hintsSinceAdvisor++;
  const hintText = buildTurnHintText(hintsSinceAdvisor);
  ctx.ui.notify(
    "[advisor-hint] " + hintText,
    hintsSinceAdvisor > 1 ? "warning" : "info",
  );
  pi.sendMessage(
    { customType: "advisor-hint", content: hintText, display: false },
    { deliverAs: "steer", triggerTurn: true },
  );
  logEvent("hint", { sessionId, toolCalls });
  while (nextHintAt <= toolCalls) nextHintAt += TOOL_CALL_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // One-time setup: ensure log directory exists.
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
  } catch {
    // Best-effort; logging handles errors silently.
  }
  pi.on("session_start", async (event, ctx) => {
    resetAllState();
    const sessionFile = ctx.sessionManager.getSessionFile();
    const basename = (sessionFile ?? "").split("/").pop() ?? "";
    const name = basename.replace(/\.jsonl$/, "");
    const parts = name.split("_");
    sessionId = parts.length >= 2 ? parts.slice(1).join("_") : name;
  });

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: event.systemPrompt
        ? `${event.systemPrompt}\n\n${PASSIVE_GUIDELINE}`
        : PASSIVE_GUIDELINE,
    };
  });

  pi.on("agent_start", async () => {
    resetHintProgress();
  });

  pi.on("turn_start", async () => {
    advisorCalledThisTurn = false;
  });

  pi.on("tool_result", async (event) => {
    if (COUNTED_TOOLS.has(event.toolName)) {
      toolCalls++;
    }

    if (event.toolName === "advisor") {
      advisorCalledThisTurn = true;
      logEvent("advisor", { sessionId, toolCalls });
      resetHintProgress();
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (!advisorCalledThisTurn && toolCalls >= nextHintAt)
      injectTurnHint(pi, ctx);
  });
}
