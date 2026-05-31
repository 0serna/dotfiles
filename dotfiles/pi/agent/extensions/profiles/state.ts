import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  FIXED_ROUTE_NAMES,
  type ConfigValidationResult,
  type PersistedConfig,
  type ThinkingLevel,
} from "./types.ts";

const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

function stateFilePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "profiles.json");
}

function isValidThinkingLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
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

  // Check required fixed route names at top level
  for (const routeName of FIXED_ROUTE_NAMES) {
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
      // Recover what we can for repair mode
      const config = tryRecoverConfig(parsed);
      return { status: "invalid", config, errors };
    }

    return { status: "valid", config: parsed as PersistedConfig };
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { status: "missing" };
    }
    // JSON parse error or other read error
    return {
      status: "invalid",
      config: null,
      errors: [(err as Error).message],
    };
  }
}

/**
 * Attempt to recover a partial PersistedConfig from structurally invalid data.
 * Returns null if nothing useful can be recovered.
 */
function tryRecoverConfig(raw: unknown): PersistedConfig | null {
  if (typeof raw !== "object" || raw === null) return null;

  const data = raw as Record<string, unknown>;

  const recovered: PersistedConfig = {
    default: { model: "", thinkingLevel: "medium" },
    high: { model: "", thinkingLevel: "medium" },
  };

  let hasAnyRoute = false;

  for (const routeName of FIXED_ROUTE_NAMES) {
    const route = data[routeName];
    if (typeof route === "object" && route !== null) {
      const r = route as Record<string, unknown>;
      if (typeof r.model === "string") {
        recovered[routeName].model = r.model;
        hasAnyRoute = true;
      }
      if (isValidThinkingLevel(r.thinkingLevel)) {
        recovered[routeName].thinkingLevel = r.thinkingLevel;
      }
    }
  }

  return hasAnyRoute ? recovered : null;
}

/** Persist the configuration to disk. */
export async function saveConfig(config: PersistedConfig): Promise<void> {
  const filePath = stateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
}
