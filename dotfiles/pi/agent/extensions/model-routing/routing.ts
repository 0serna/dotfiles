import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { parseModelId } from "./model-ids.ts";
import { isRouteName, type RouteName } from "./routes.ts";
import type { ModelRoute } from "./types.ts";

/**
 * Activate a route's model and thinking level. Returns true when both
 * steps succeed. When activation fails, callers are expected to leave
 * the current model and thinking level untouched and surface a warning.
 */
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

/**
 * Return the route token for a given user input, or undefined when the
 * first token is not a declared route. `/compact` is intentionally not
 * matched here: it is handled by the `session_before_compact` hook
 * instead of an `input` event.
 */
export function getRouteName(input: string): RouteName | undefined {
  const [token] = input.trim().split(/\s+/);
  if (!token) return undefined;
  if (token === "/compact") return undefined;
  if (!isRouteName(token)) return undefined;
  return token;
}
