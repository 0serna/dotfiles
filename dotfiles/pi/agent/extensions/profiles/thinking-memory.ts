import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ThinkingLevel } from "./types.ts";

type ThinkingMemory = Record<string, ThinkingLevel>;

const DEBOUNCE_MS = 100;

let memory: ThinkingMemory = {};
let writeTimer: ReturnType<typeof setTimeout> | undefined;

function memoryFilePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "thinking-memory.json");
}

export async function loadMemory(): Promise<void> {
  try {
    const raw = await readFile(memoryFilePath(), "utf8");
    memory = JSON.parse(raw) as ThinkingMemory;
  } catch {
    memory = {};
  }
}

export function getRememberedLevel(modelId: string): ThinkingLevel | undefined {
  return memory[modelId];
}

export function recordLevel(modelId: string, level: ThinkingLevel): void {
  if (memory[modelId] === level) return;
  memory[modelId] = level;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(writeMemory, DEBOUNCE_MS);
}

function writeMemory(): void {
  const filePath = memoryFilePath();
  void mkdir(dirname(filePath), { recursive: true }).then(() =>
    writeFile(filePath, JSON.stringify(memory, null, 2), "utf8"),
  );
}
