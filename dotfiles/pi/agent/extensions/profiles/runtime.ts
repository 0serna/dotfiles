import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { DEFAULT_ROUTE } from "./profiles.ts";
import {
  activateRoute,
  getActiveProfile,
  isConfigEnabled,
  validateConfigSemantics,
} from "./routing.ts";
import { loadConfig } from "./state.ts";
import type {
  ConfigValidationResult,
  PersistedConfig,
  Profile,
  ProfileName,
  RouteSnapshot,
} from "./types.ts";

export function createProfilesRuntime(pi: ExtensionAPI) {
  let configResult: ConfigValidationResult = { status: "missing" };
  let config: PersistedConfig | null = null;
  let activeProfile: Profile | null = null;
  let activeProfileName: ProfileName | null = null;
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
      const resolved = getActiveProfile(config);
      activeProfile = resolved?.profile ?? null;
      activeProfileName = resolved?.name ?? null;
    } else {
      config = configResult.status === "invalid" ? configResult.config : null;
      activeProfile = null;
      activeProfileName = null;
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
        "Profile configuration missing. Routing disabled; use /profiles to set it up.",
        "warning",
      );
    } else if (configResult.status === "invalid") {
      const msg =
        configResult.errors.length > 0
          ? configResult.errors.join("; ")
          : "Unknown validation error";
      ctx.ui.notify(
        `Profile configuration invalid: ${msg}. Routing disabled; use /profiles to repair it.`,
        "warning",
      );
    }
  }

  function publishStatus(ctx: ExtensionContext): void {
    if (configResult.status === "missing") {
      ctx.ui.setStatus("profiles", ctx.ui.theme.fg("warning", "profile setup"));
      return;
    }

    if (configResult.status === "invalid") {
      ctx.ui.setStatus(
        "profiles",
        ctx.ui.theme.fg("warning", "profile invalid"),
      );
      return;
    }

    ctx.ui.setStatus(
      "profiles",
      ctx.ui.theme.fg("dim", activeProfileName ?? "unknown"),
    );
  }

  function publishFailedStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus("profiles", ctx.ui.theme.fg("warning", "profile failed"));
  }

  async function tryActivateDefault(ctx: ExtensionContext): Promise<boolean> {
    if (!configEnabled() || !activeProfile) return false;
    const route = activeProfile[DEFAULT_ROUTE];
    const activated = await activateRoute(pi, route, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate model '${route.model}' for profile '${activeProfileName}'; continuing with current model.`,
        "warning",
      );
    }
    return activated;
  }

  function consumeSnapshot(): RouteSnapshot | undefined {
    const s = snapshot;
    snapshot = undefined;
    return s;
  }

  return {
    refreshConfig,
    configEnabled,
    warnOnce,
    publishStatus,
    publishFailedStatus,
    tryActivateDefault,
    getConfigResult: () => configResult,
    getConfig: () => config,
    getActiveProfile: () => activeProfile,
    getActiveProfileName: () => activeProfileName,
    saveSnapshot: (s: RouteSnapshot) => {
      snapshot = s;
    },
    hasSnapshot: () => snapshot !== undefined,
    consumeSnapshot,
    restoreSnapshot: async (ctx: ExtensionContext): Promise<boolean> => {
      const s = consumeSnapshot();
      if (!s || !s.model) return false;

      // Avoid setModel if the model is already active
      if (
        !ctx.model ||
        ctx.model.provider !== s.model.provider ||
        ctx.model.id !== s.model.id
      ) {
        const activated = await pi.setModel(s.model);
        if (!activated) return false;
      }

      pi.setThinkingLevel(s.thinkingLevel);
      return true;
    },
  };
}

export type ProfilesRuntime = ReturnType<typeof createProfilesRuntime>;
