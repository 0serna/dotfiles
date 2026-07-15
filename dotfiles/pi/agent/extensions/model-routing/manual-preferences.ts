import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isValidThinkingLevel, type ThinkingLevel } from "./types.ts";

/**
 * A model and thinking-level pair selected manually. The latest persisted
 * manual selection initializes new sessions; each session then owns its
 * in-memory copy for route restoration.
 */
export interface ManualSelection {
  modelProvider: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
}

/**
 * A map of formatted `provider/model` identity to the thinking level the user
 * last selected manually for that model. Survives Pi restarts.
 */
type ThinkingMemory = Record<string, ThinkingLevel>;

/**
 * The unified manual-preference snapshot. A session owns its in-memory
 * snapshot while the same shape is published globally as the latest persisted
 * manual preferences for future sessions.
 *
 * `model-routes.json` is intentionally kept separate because it stores
 * automatic route configuration, which has a different lifecycle.
 */
export interface ManualPreferences {
  selection: ManualSelection | null;
  thinkingMemory: ThinkingMemory;
}

function filePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "manual-preferences.json");
}

function tempFilePath(): string {
  return `${filePath()}.tmp`;
}

function isManualSelection(value: unknown): value is ManualSelection {
  if (typeof value !== "object" || value === null) return false;
  const selection = value as Record<string, unknown>;
  return (
    typeof selection.modelProvider === "string" &&
    typeof selection.modelId === "string" &&
    isValidThinkingLevel(selection.thinkingLevel)
  );
}

function isThinkingMemory(value: unknown): value is ThinkingMemory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  for (const v of Object.values(value)) {
    if (!isValidThinkingLevel(v)) return false;
  }
  return true;
}

function isManualPreferences(value: unknown): value is ManualPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  if (data.selection !== null && data.selection !== undefined) {
    if (!isManualSelection(data.selection)) return false;
  }
  if (data.thinkingMemory !== undefined) {
    if (!isThinkingMemory(data.thinkingMemory)) return false;
  }
  return true;
}

export function emptyManualPreferences(): ManualPreferences {
  return { selection: null, thinkingMemory: {} };
}

/**
 * Process-local FIFO write queue. Every write is enqueued after the previous
 * one; readers await the queue before reading so a read can never observe a
 * half-applied snapshot.
 */
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Load and structurally validate the latest persisted manual preferences.
 * Returns an empty record if the file is missing or malformed; persistence
 * is best-effort and must never break the session flow.
 */
export async function loadManualPreferences(): Promise<ManualPreferences> {
  await writeQueue;
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isManualPreferences(parsed)) return emptyManualPreferences();
    return {
      selection: parsed.selection ?? null,
      thinkingMemory: parsed.thinkingMemory ?? {},
    };
  } catch {
    return emptyManualPreferences();
  }
}

/**
 * Persist a complete manual-preferences snapshot. Writes are serialized through
 * a process-local FIFO queue and performed as an atomic rename of a temporary
 * file so readers always see either the previous full record or the next full
 * record, never a partial document.
 */
export function saveManualPreferences(
  preferences: ManualPreferences,
): Promise<void> {
  const content = JSON.stringify(preferences, null, 2);
  const write = writeQueue.then(async () => {
    try {
      const path = filePath();
      const tmp = tempFilePath();
      await mkdir(dirname(path), { recursive: true });
      await writeFile(tmp, content, "utf8");
      await rename(tmp, path);
    } catch {
      // Persisting preferences is best effort; failures must not break session flow.
    }
  });
  writeQueue = write;
  return write;
}

/** Snapshot helpers used by the transition coordinator. */
export function withSelection(
  preferences: ManualPreferences,
  selection: ManualSelection,
): ManualPreferences {
  return {
    selection,
    thinkingMemory: {
      ...preferences.thinkingMemory,
      [`${selection.modelProvider}/${selection.modelId}`]:
        selection.thinkingLevel,
    },
  };
}
