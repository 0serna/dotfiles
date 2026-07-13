import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_DIR = join(homedir(), ".local/state/pi");
const MAX_LOG_BYTES = 10 * 1024 * 1024;
const TRUNCATE_TO_BYTES = MAX_LOG_BYTES / 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of the pi extension context needed by the logger. */
export interface LoggerContext {
  sessionManager: { getSessionId(): string | null | undefined };
  model?: { id?: string } | null;
}

/** A bound logger that auto-injects sessionId and model into every entry. */
export interface ExtensionLogger {
  /**
   * Write a log entry with extension and context pre-bound.
   *
   * @param event  Short event identifier (e.g. `hint`, `fetch_succeeded`).
   * @param data   Optional structured payload written under `data`.
   */
  log(event: string, data?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEntry(
  extension: string,
  event: string,
  sessionId: string | null,
  model: string | null,
  data?: Record<string, unknown>,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    extension,
    event,
    sessionId,
    model,
    data: data ?? {},
  };

  try {
    return JSON.stringify(entry) + "\n";
  } catch {
    entry.data = {};
    return JSON.stringify(entry) + "\n";
  }
}

function truncateFile(filePath: string): void {
  if (statSync(filePath).size <= MAX_LOG_BYTES) return;

  const content = readFileSync(filePath);
  const start = Math.max(0, content.length - TRUNCATE_TO_BYTES);
  const tail = content.subarray(start);
  const startsAtLineBoundary = start === 0 || content[start - 1] === 0x0a;

  let truncated: Buffer;
  if (startsAtLineBoundary) {
    truncated = tail;
  } else {
    const firstNewline = tail.indexOf(0x0a);
    truncated =
      firstNewline === -1 ? Buffer.alloc(0) : tail.subarray(firstNewline + 1);
  }

  const tmpPath = filePath + ".tmp";
  rmSync(tmpPath, { force: true });
  writeFileSync(tmpPath, truncated);
  renameSync(tmpPath, filePath);
}

function writeEntry(
  extension: string,
  event: string,
  sessionId: string | null,
  model: string | null,
  data?: Record<string, unknown>,
): void {
  const logFile = join(BASE_DIR, `${extension}.log`);
  const line = formatEntry(extension, event, sessionId, model, data);

  mkdirSync(BASE_DIR, { recursive: true });
  appendFileSync(logFile, line);
  truncateFile(logFile);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a bound logger for an extension.
 *
 * The returned logger automatically:
 * - Writes to `~/.local/state/pi/<extension>.log`
 * - Includes `sessionId` (snapshot from context creation)
 * - Includes `model` (read live from context on each call)
 * - Nests user payload under `data`
 *
 * Reserved metadata fields (`timestamp`, `extension`, `event`, `sessionId`,
 * `model`, `data`) always appear at the top level and cannot be overwritten
 * by user-supplied payload keys.
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
        writeEntry(extension, event, sessionId, ctx.model?.id ?? null, data);
      } catch {
        // Silent — logging must never break the extension.
      }
    },
  };
}
