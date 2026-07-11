import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  isValidThinkingLevel,
  ROUTE_NAMES,
  type ConfigValidationResult,
  type PersistedConfig,
} from "./types.ts";

function stateFilePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "profiles.json");
}

function isValidRoute(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.model === "string" && isValidThinkingLevel(r.thinkingLevel);
}

function structuralErrors(raw: unknown): string[] {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    errors.push("Config must be a JSON object");
    return errors;
  }

  const data = raw as Record<string, unknown>;

  for (const routeName of ROUTE_NAMES) {
    if (!(routeName in data)) {
      errors.push(`Missing required route '${routeName}'`);
      continue;
    }

    if (!isValidRoute(data[routeName])) {
      errors.push(
        `Route '${routeName}': invalid or missing model/thinkingLevel`,
      );
    }
  }

  return errors;
}

/**
 * Load and structurally validate the persisted configuration.
 * This does NOT check model availability or thinking level support
 * (those require access to ctx.modelRegistry and getSupportedThinkingLevels).
 */
export async function loadConfig(): Promise<ConfigValidationResult> {
  try {
    const content = await readFile(stateFilePath(), "utf8");
    const parsed = JSON.parse(content) as unknown;

    const errors = structuralErrors(parsed);

    if (errors.length > 0) {
      return { status: "invalid", config: null, errors };
    }

    return { status: "valid", config: parsed as PersistedConfig };
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { status: "missing" };
    }
    return {
      status: "invalid",
      config: null,
      errors: [(err as Error).message],
    };
  }
}

/** Persist the configuration to disk. */
export async function saveConfig(config: PersistedConfig): Promise<void> {
  const filePath = stateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
}
