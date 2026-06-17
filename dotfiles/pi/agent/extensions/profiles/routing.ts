import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { parseModelId } from "./model-ids.ts";
import { ROUTE_TYPES, type RouteName } from "./routes.ts";
import type { ModelRoute, PersistedConfig } from "./types.ts";

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
  const availableModels = ctx.modelRegistry.getAvailable();

  for (const routeName of ["light", "high"] as const) {
    const route = config[routeName];
    if (!route) {
      errors.push(`Missing required route '${routeName}'`);
      continue;
    }

    const [provider, modelId] = parseModelId(route.model);
    const model = ctx.modelRegistry.find(provider, modelId);
    if (!model) {
      errors.push(`Route '${routeName}': model '${route.model}' not found`);
      continue;
    }

    if (
      !availableModels.some(
        (m) => m.id === model.id && m.provider === model.provider,
      )
    ) {
      errors.push(
        `Route '${routeName}': model '${route.model}' has no configured API key`,
      );
    }

    const supportedLevels = getSupportedThinkingLevels(model);
    if (!supportedLevels.includes(route.thinkingLevel)) {
      errors.push(
        `Route '${routeName}': thinking level '${route.thinkingLevel}' ` +
          `not supported by model '${route.model}' (supported: ${supportedLevels.join(", ")})`,
      );
    }
  }

  return errors;
}
