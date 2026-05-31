import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DEFAULT_ROUTE } from "./routes.ts";
import {
  activateRoute,
  isConfigEnabled,
  validateConfigSemantics,
} from "./routing.ts";
import { loadConfig } from "./state.ts";
import type {
  ConfigValidationResult,
  PersistedConfig,
  RouteSnapshot,
} from "./types.ts";

export function createProfilesRuntime(pi: ExtensionAPI) {
  let configResult: ConfigValidationResult = { status: "missing" };
  let config: PersistedConfig | null = null;
  let warningShownThisSession = false;
  let snapshot: RouteSnapshot | undefined;

  async function refreshConfig(ctx?: ExtensionContext): Promise<void> {
    configResult = await loadConfig();

    if (configResult.status === "valid" && ctx) {
      const errors = await validateConfigSemantics(configResult.config, ctx);
      if (errors.length > 0) {
        configResult = {
          status: "invalid",
          config: configResult.config,
          errors,
        };
      }
    }

    if (configResult.status === "valid") {
      config = configResult.config;
    } else {
      config = configResult.status === "invalid" ? configResult.config : null;
    }
  }

  function configEnabled(): boolean {
    return isConfigEnabled(configResult);
  }

  async function warnOnce(ctx: ExtensionContext): Promise<void> {
    if (warningShownThisSession) return;
    warningShownThisSession = true;

    if (configResult.status === "missing") {
      ctx.ui.notify(
        "Profile configuration missing. Routing disabled; use /profile to set it up.",
        "warning",
      );
    } else if (configResult.status === "invalid") {
      const msg =
        configResult.errors.length > 0
          ? configResult.errors.join("; ")
          : "Unknown validation error";
      ctx.ui.notify(
        `Profile configuration invalid: ${msg}. Routing disabled; use /profile to repair it.`,
        "warning",
      );
    }
  }

  async function tryActivateDefault(ctx: ExtensionContext): Promise<boolean> {
    if (!configEnabled() || !config) return false;
    const route = config[DEFAULT_ROUTE];
    const activated = await activateRoute(pi, route, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate model '${route.model}' for default route; continuing with current model.`,
        "warning",
      );
    }
    return activated;
  }

  return {
    refreshConfig,
    configEnabled,
    warnOnce,
    tryActivateDefault,
    getConfigResult: () => configResult,
    getConfig: () => config,
    saveSnapshot: (s: RouteSnapshot) => {
      snapshot = s;
    },
    hasSnapshot: () => snapshot !== undefined,
    consumeSnapshot: (): RouteSnapshot | undefined => {
      const s = snapshot;
      snapshot = undefined;
      return s;
    },
  };
}

export type ProfilesRuntime = ReturnType<typeof createProfilesRuntime>;
