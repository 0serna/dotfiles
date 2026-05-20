import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  FALLBACK_PROFILE,
  PROFILES,
  ROUTE_TYPES,
  type ProfileName,
  type RouteName,
} from "./profiles.ts";
import type { ModelProfile, ModelRoute, PersistedState } from "./types.ts";

function parseModelId(modelId: string): [provider: string, model: string] {
  const slashIndex = modelId.indexOf("/");
  if (slashIndex === -1) return ["", modelId];
  return [modelId.slice(0, slashIndex), modelId.slice(slashIndex + 1)];
}

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
  const [routeName] = input.trim().split(/\s+/);
  if (!routeName || !(routeName in ROUTE_TYPES)) return undefined;
  return routeName as RouteName;
}

export function resolveActiveProfile(
  persisted: PersistedState | undefined,
): ModelProfile {
  const persistedName = persisted?.activeProfile;
  if (persistedName && persistedName in PROFILES) {
    return PROFILES[persistedName as ProfileName];
  }
  return PROFILES[FALLBACK_PROFILE];
}
