import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_DIR = join(homedir(), ".local/state/pi");
const MAX_LOG_LINES = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of the pi extension context needed by the logger. */
interface LoggerContext {
  sessionManager: { getSessionId(): string | null | undefined };
  model?: { id?: string } | null;
}

/** A bound logger that auto-injects sessionId and model into every entry. */
export interface ExtensionLogger {
  /**
   * Write a log entry with extension and context pre-bound.
   *
   * @param event  Short event identifier (e.g. `hint`, `fetch_succeeded`).
   * @param data   Optional structured payload merged with auto-injected fields.
   */
  log(event: string, data?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeData(
  autoFields: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...autoFields, ...data, ...autoFields };
}

function formatEntry(
  extension: string,
  event: string,
  data?: Record<string, unknown>,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    extension,
    event,
  };

  if (data !== undefined) {
    try {
      return JSON.stringify({ ...entry, ...data }) + "\n";
    } catch {
      // Serialization failure — omit data, write minimal entry.
    }
  }

  return JSON.stringify(entry) + "\n";
}

function truncateLines(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  if (lines.length > MAX_LOG_LINES) {
    writeFileSync(filePath, lines.slice(-MAX_LOG_LINES).join("\n"));
  }
}

function writeEntry(
  extension: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  const logFile = join(BASE_DIR, `${extension}.log`);
  const line = formatEntry(extension, event, data);

  mkdirSync(BASE_DIR, { recursive: true });
  appendFileSync(logFile, line);
  truncateLines(logFile);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write a structured log entry to `~/.local/state/pi/<extension>.log`.
 *
 * Format (one JSON object per line):
 *   {\"timestamp\":\"...\",\"extension\":\"...\",\"event\":\"...\",...}\n
 *
 * Logging is best-effort and silent on failure — it never throws.
 *
 * @param extension  Extension name (becomes the filename).
 * @param event   Short event identifier (e.g. `hint`, `fetch_succeeded`).
 * @param data    Optional structured payload serialized as JSON.
 */
export function log(
  extension: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  try {
    writeEntry(extension, event, data);
  } catch {
    // Silent — logging must never break the extension.
  }
}

/**
 * Create a bound logger for an extension.
 *
 * The returned logger automatically:
 * - Writes to `~/.local/state/pi/<extension>.log`
 * - Includes `sessionId` (snapshot from context creation)
 * - Includes `model` (read live from context on each call)
 *
 * Auto-injected fields (`sessionId`, `model`) take precedence over
 * any user-supplied keys in the data argument — they cannot be
 * overwritten.
 *
 * Logging is best-effort and silent on failure — it never throws.
 *
 * @param ctx     Extension context (from a pi event handler).
 * @param extension  Extension name (becomes the filename).
 */
export function createExtensionLogger(
  ctx: LoggerContext,
  extension: string,
): ExtensionLogger {
  const sessionId = ctx.sessionManager.getSessionId() ?? null;

  return {
    log(event: string, data?: Record<string, unknown>): void {
      try {
        const autoFields = {
          sessionId,
          model: ctx.model?.id ?? null,
        };

        writeEntry(extension, event, mergeData(autoFields, data));
      } catch {
        // Silent — logging must never break the extension.
      }
    },
  };
}
