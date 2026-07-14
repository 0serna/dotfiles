import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseModelId } from "./model-ids.ts";
import { ROUTE_TOKENS, isRouteName, type RouteName } from "./routes.ts";
import { isValidModelRoute, loadConfig, saveConfig } from "./state.ts";
import type { ModelRoute, ModelRoutesConfig } from "./types.ts";

type RouteActivation =
  | { kind: "configured"; route: ModelRoute }
  | { kind: "unset" }
  | { kind: "missing_credentials"; route: ModelRoute }
  | { kind: "unknown_model"; route: ModelRoute }
  | { kind: "unsupported_thinking"; route: ModelRoute };

const EMPTY: RouteActivation = { kind: "unset" };

function buildEmpty(): Record<RouteName, RouteActivation> {
  const record = {} as Record<RouteName, RouteActivation>;
  for (const token of ROUTE_TOKENS) {
    record[token] = EMPTY;
  }
  return record;
}

/**
 * Classify one route's configuration. Routes with an unknown model or
 * an unsupported thinking level are reported as such so the persisted
 * file can be canonicalized; routes with a known model but missing
 * credentials are kept so the configuration survives transient
 * credential outages.
 */
function classifyRoute(route: unknown, ctx: ExtensionContext): RouteActivation {
  if (!isValidModelRoute(route)) return EMPTY;

  const [provider, modelId] = parseModelId(route.model);
  const model = ctx.modelRegistry.find(provider, modelId);
  if (!model) return { kind: "unknown_model", route };

  const supportedLevels = getSupportedThinkingLevels(model);
  if (!supportedLevels.includes(route.thinkingLevel)) {
    return { kind: "unsupported_thinking", route };
  }

  const available = ctx.modelRegistry
    .getAvailable()
    .some((m) => m.id === model.id && m.provider === model.provider);
  if (!available) {
    return { kind: "missing_credentials", route };
  }

  return { kind: "configured", route };
}

function shapesEqual(a: ModelRoutesConfig, b: ModelRoutesConfig): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  for (const key of aKeys) {
    const ra = a[key]!;
    const rb = b[key]!;
    if (ra.model !== rb.model || ra.thinkingLevel !== rb.thinkingLevel) {
      return false;
    }
  }
  return true;
}

export function createModelRoutesRuntime() {
  let config: ModelRoutesConfig = {};
  let rawConfig: ModelRoutesConfig = {};
  let activation: Record<RouteName, RouteActivation> = buildEmpty();
  let configStatus: "valid" | "missing" | "invalid" = "missing";
  let configErrors: string[] = [];
  let warningShownThisSession = false;

  /**
   * Reload the persisted configuration and refresh per-route
   * activation. When a parseable file sanitizes to a different
   * canonical shape, the file is rewritten so subsequent reads return
   * a clean catalog. Unreadable or unparseable files are left alone
   * and routing is disabled.
   */
  async function refreshConfig(ctx: ExtensionContext): Promise<void> {
    const result = await loadConfig();
    configStatus = result.status;
    configErrors = result.status === "invalid" ? result.errors : [];
    rawConfig = result.status === "valid" ? result.config : {};
    config = {};

    activation = buildEmpty();
    const canonical: ModelRoutesConfig = {};
    for (const token of ROUTE_TOKENS) {
      const state = classifyRoute(rawConfig[token], ctx);
      activation[token] = state;
      if (state.kind === "configured" || state.kind === "missing_credentials") {
        canonical[token] = state.route;
        config[token] = state.route;
      }
    }

    if (result.status === "valid" && !shapesEqual(canonical, rawConfig)) {
      await saveConfig(canonical);
    }
  }

  function isRouteUsable(token: string): boolean {
    if (!isRouteName(token)) return false;
    return activation[token].kind === "configured";
  }

  function getRouteConfig(token: string): ModelRoute | null {
    if (!isRouteName(token)) return null;
    const state = activation[token];
    return state.kind === "configured" ? state.route : null;
  }

  async function warnOnce(ctx: ExtensionContext): Promise<void> {
    if (warningShownThisSession) return;
    warningShownThisSession = true;

    if (configStatus === "missing") {
      ctx.ui.notify(
        "Model route configuration missing. Routing disabled; use /model-routes to set it up.",
        "error",
      );
      return;
    }

    if (configStatus === "invalid") {
      const msg =
        configErrors.length > 0
          ? configErrors.join("; ")
          : "Unknown validation error";
      ctx.ui.notify(
        `Model route configuration unreadable: ${msg}. Routing disabled; original file preserved, use /model-routes after fixing it.`,
        "error",
      );
      return;
    }
  }

  return {
    refreshConfig,
    isRouteUsable,
    getRouteConfig,
    warnOnce,
    getStatus: () => configStatus,
    getErrors: () => configErrors,
    getActivation: () => activation,
    getConfigSnapshot: () => config,
  };
}

export type ModelRoutesRuntime = ReturnType<typeof createModelRoutesRuntime>;
