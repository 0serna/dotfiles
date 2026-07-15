import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isValidThinkingLevel, type ThinkingLevel } from "./types.ts";

/** A session-owned model and thinking-level pair used as a route baseline. */
export interface BaselineSelection {
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
 * Durable per-model thinking preferences. The route restoration baseline is
 * session-owned and intentionally excluded from this shared file.
 *
 * `model-routes.json` is intentionally kept separate because it stores
 * automatic route configuration, which has a different lifecycle.
 */
export interface ThinkingPreferences {
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

function isThinkingMemory(value: unknown): value is ThinkingMemory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  for (const v of Object.values(value)) {
    if (!isValidThinkingLevel(v)) return false;
  }
  return true;
}

function isThinkingPreferences(value: unknown): value is ThinkingPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return (
    data.thinkingMemory === undefined || isThinkingMemory(data.thinkingMemory)
  );
}

export function emptyThinkingPreferences(): ThinkingPreferences {
  return { thinkingMemory: {} };
}

/**
 * Process-local FIFO write queue. Every write is enqueued after the previous
 * one; readers await the queue before reading so a read can never observe a
 * half-applied snapshot.
 */
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Load and structurally validate the persisted per-model thinking preferences.
 * Returns an empty record if the file is missing or malformed; persistence
 * is best-effort and must never break the session flow.
 */
export async function loadThinkingPreferences(): Promise<ThinkingPreferences> {
  await writeQueue;
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isThinkingPreferences(parsed)) return emptyThinkingPreferences();
    return { thinkingMemory: parsed.thinkingMemory ?? {} };
  } catch {
    return emptyThinkingPreferences();
  }
}

/**
 * Persist a complete thinking-preferences snapshot. Writes are serialized through
 * a process-local FIFO queue and performed as an atomic rename of a temporary
 * file so readers always see either the previous full record or the next full
 * record, never a partial document.
 */
export function saveThinkingPreferences(
  preferences: ThinkingPreferences,
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

/** Record the selected model's level without persisting a route baseline. */
export function withRememberedSelection(
  preferences: ThinkingPreferences,
  selection: BaselineSelection,
): ThinkingPreferences {
  return {
    thinkingMemory: {
      ...preferences.thinkingMemory,
      [`${selection.modelProvider}/${selection.modelId}`]:
        selection.thinkingLevel,
    },
  };
}
