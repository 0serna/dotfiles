import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  FIXED_PROFILE_NAMES,
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
  return join(stateHome, "pi", "model-profile.json");
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

  // Validate activeProfile
  if (typeof data.activeProfile !== "string") {
    errors.push("Missing or invalid 'activeProfile' (expected string)");
  }

  // Validate profiles
  if (typeof data.profiles !== "object" || data.profiles === null) {
    errors.push("Missing or invalid 'profiles' (expected object)");
    return errors;
  }

  const profiles = data.profiles as Record<string, unknown>;

  // Check required fixed profile names
  for (const name of FIXED_PROFILE_NAMES) {
    if (!(name in profiles)) {
      errors.push(`Missing required profile '${name}'`);
      continue;
    }

    const profile = profiles[name];
    if (typeof profile !== "object" || profile === null) {
      errors.push(`Profile '${name}' must be an object`);
      continue;
    }

    const p = profile as Record<string, unknown>;

    // Check required fixed route names
    for (const routeName of FIXED_ROUTE_NAMES) {
      if (!(routeName in p)) {
        errors.push(`Profile '${name}' missing route '${routeName}'`);
        continue;
      }

      if (!isValidRoute(p[routeName])) {
        errors.push(
          `Profile '${name}', route '${routeName}': invalid or missing model/thinkingLevel`,
        );
      }
    }
  }

  return errors;
}

/**
 * Load and structurally validate the persisted profile configuration.
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
  const activeProfile =
    typeof data.activeProfile === "string"
      ? data.activeProfile
      : FIXED_PROFILE_NAMES[0];

  const profiles: Record<string, unknown> =
    typeof data.profiles === "object" && data.profiles !== null
      ? (data.profiles as Record<string, unknown>)
      : {};

  const recoveredProfiles: PersistedConfig["profiles"] = {};

  for (const name of FIXED_PROFILE_NAMES) {
    const profile = profiles[name];
    if (typeof profile !== "object" || profile === null) {
      // Can't recover this profile
      continue;
    }

    const p = profile as Record<string, unknown>;
    const recoveredRoute: PersistedConfig["profiles"][string] = {
      default: { model: "", thinkingLevel: "medium" },
      light: { model: "", thinkingLevel: "medium" },
      heavy: { model: "", thinkingLevel: "medium" },
    };

    for (const routeName of FIXED_ROUTE_NAMES) {
      const route = p[routeName];
      if (typeof route === "object" && route !== null) {
        const r = route as Record<string, unknown>;
        if (typeof r.model === "string") {
          recoveredRoute[routeName].model = r.model;
        }
        if (isValidThinkingLevel(r.thinkingLevel)) {
          recoveredRoute[routeName].thinkingLevel = r.thinkingLevel;
        }
      }
    }

    recoveredProfiles[name] = recoveredRoute;
  }

  if (Object.keys(recoveredProfiles).length === 0) return null;

  return { activeProfile, profiles: recoveredProfiles };
}

/** Persist the profile configuration to disk. */
export async function saveConfig(config: PersistedConfig): Promise<void> {
  const filePath = stateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf8");
}
