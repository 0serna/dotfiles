import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { parseModelId } from "./model-ids.ts";
import { ROUTE_TYPES, type RouteName } from "./profiles.ts";
import type {
  ConfigValidationResult,
  ModelProfile,
  ModelRoute,
  PersistedConfig,
  ProfileName,
} from "./types.ts";
import { FIXED_PROFILE_NAMES, FIXED_ROUTE_NAMES } from "./types.ts";

export async function activateRoute(
  pi: ExtensionAPI,
  route: ModelRoute,
  ctx: ExtensionContext,
): Promise<boolean> {
  const [provider, modelId] = parseModelId(route.model);
  const model = ctx.modelRegistry.find(provider, modelId);
  const activated = model ? await pi.setModel(model) : false;
  if (!activated) return false;

  pi.setThinkingLevel(route.thinkingLevel);
  return true;
}

export function getRouteName(input: string): RouteName | undefined {
  const [token] = input.trim().split(/\s+/);
  if (!token || !(token in ROUTE_TYPES)) return undefined;
  return token as RouteName;
}

/**
 * Get the active ModelProfile and its name from a valid config.
 * Returns undefined if the config is null or the active profile doesn't exist.
 */
export function getActiveProfile(
  config: PersistedConfig | null,
): { profile: ModelProfile; name: ProfileName } | undefined {
  if (!config) return undefined;

  const profile = config.profiles[config.activeProfile];
  if (!profile) return undefined;

  // Verify it's one of the fixed profile names
  if (
    !(FIXED_PROFILE_NAMES as readonly string[]).includes(config.activeProfile)
  ) {
    return undefined;
  }

  return { profile, name: config.activeProfile as ProfileName };
}

/**
 * Check whether profile configuration is usable for routing.
 * A config is usable when status is "valid" and the active profile
 * resolves to a known profile name.
 */
export function isConfigEnabled(result: ConfigValidationResult): boolean {
  if (result.status !== "valid") return false;
  return getActiveProfile(result.config) !== undefined;
}

/**
 * Run semantic validation on a persisted config.
 * Checks that each route's model is available and the thinking level
 * is supported by that model.
 *
 * Returns a list of error messages (empty = all valid).
 */
export async function validateConfigSemantics(
  config: PersistedConfig,
  ctx: ExtensionContext,
): Promise<string[]> {
  const errors: string[] = [];

  for (const profileName of FIXED_PROFILE_NAMES) {
    const profile = config.profiles[profileName];
    if (!profile) {
      errors.push(`Missing required profile '${profileName}'`);
      continue;
    }

    for (const routeName of FIXED_ROUTE_NAMES) {
      const route = profile[routeName];
      if (!route) {
        errors.push(`Profile '${profileName}' missing route '${routeName}'`);
        continue;
      }
      const [provider, modelId] = parseModelId(route.model);
      const model = ctx.modelRegistry.find(provider, modelId);

      if (!model) {
        errors.push(
          `Profile '${profileName}', route '${routeName}': model '${route.model}' not found`,
        );
        continue;
      }

      const available = ctx.modelRegistry.getAvailable();
      if (
        !available.some(
          (m) => m.id === model.id && m.provider === model.provider,
        )
      ) {
        errors.push(
          `Profile '${profileName}', route '${routeName}': model '${route.model}' has no configured API key`,
        );
      }

      const supportedLevels = getSupportedThinkingLevels(model);
      if (!supportedLevels.includes(route.thinkingLevel)) {
        errors.push(
          `Profile '${profileName}', route '${routeName}': thinking level '${route.thinkingLevel}' ` +
            `not supported by model '${route.model}' (supported: ${supportedLevels.join(", ")})`,
        );
      }
    }
  }

  return errors;
}
