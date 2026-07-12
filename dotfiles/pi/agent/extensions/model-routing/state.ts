import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ROUTE_TOKENS } from "./routes.ts";
import {
  isValidThinkingLevel,
  type ModelRoute,
  type ModelRoutesConfig,
  type RoutesValidationResult,
} from "./types.ts";

function stateFilePath(): string {
  const stateHome =
    process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state");
  return join(stateHome, "pi", "model-routes.json");
}

function structuralErrors(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return ["Configuration must be a JSON object"];
  }
  return [];
}

/**
 * Read the raw route configuration. The returned record mirrors the
 * on-disk JSON, including any undeclared or invalid entries. Sanitization
 * (dropping undeclared keys and unknown models, etc.) happens in
 * `runtime.ts`, which is the only layer that can compare the loaded
 * shape against the canonical one and rewrite the file.
 */
export async function loadConfig(): Promise<RoutesValidationResult> {
  let content: string;
  try {
    content = await readFile(stateFilePath(), "utf8");
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    return {
      status: "invalid",
      config: null,
      errors: [(err as Error).message],
    };
  }

  const errors = structuralErrors(parsed);
  if (errors.length > 0) {
    return { status: "invalid", config: null, errors };
  }

  return { status: "valid", config: parsed as ModelRoutesConfig };
}

/** Returns true when the value is a well-formed `ModelRoute`. */
export function isValidModelRoute(value: unknown): value is ModelRoute {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.model === "string" && isValidThinkingLevel(r.thinkingLevel);
}

/**
 * Persist a partial route configuration. Only declared, configured
 * routes are written; unset routes are omitted and undeclared entries
 * are removed.
 */
export async function saveConfig(config: ModelRoutesConfig): Promise<void> {
  const declared = new Set<string>(ROUTE_TOKENS as readonly string[]);
  const filtered: ModelRoutesConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (!declared.has(key)) continue;
    if (!isValidModelRoute(value)) continue;
    filtered[key] = value;
  }

  const filePath = stateFilePath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(filtered, null, 2), "utf8");
}
