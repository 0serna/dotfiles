import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ThinkingLevel } from "./types.ts";

export interface UserSelection {
  modelProvider: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
}

function filePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "user-selection.json");
}

let writeQueue: Promise<void> = Promise.resolve();

export async function loadUserSelection(): Promise<UserSelection | null> {
  await writeQueue;
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;

    const selection = parsed as Partial<UserSelection>;
    if (
      typeof selection.modelProvider !== "string" ||
      typeof selection.modelId !== "string" ||
      typeof selection.thinkingLevel !== "string"
    ) {
      return null;
    }

    return selection as UserSelection;
  } catch {
    return null;
  }
}

export function saveUserSelection(selection: UserSelection): Promise<void> {
  const content = JSON.stringify(selection, null, 2);
  const write = writeQueue.then(async () => {
    try {
      const path = filePath();
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    } catch {
      // Persisting the selection is best effort; failures must not break session flow.
    }
  });
  writeQueue = write;
  return write;
}
