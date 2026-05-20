import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { PersistedState } from "./types.ts";

function stateFilePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "model-profile.json");
}

export async function readState(): Promise<PersistedState | undefined> {
  try {
    const content = await readFile(stateFilePath(), "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown> | null;
    if (parsed && typeof parsed.activeProfile === "string") {
      return { activeProfile: parsed.activeProfile };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function writeState(profileName: string): Promise<void> {
  const filePath = stateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify({ activeProfile: profileName }, null, 2),
    "utf8",
  );
}
