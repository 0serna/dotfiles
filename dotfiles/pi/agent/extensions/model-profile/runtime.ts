import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  activateRoute,
  getActiveProfile,
  isConfigEnabled,
  validateConfigSemantics,
} from "./routing.ts";
import { loadConfig } from "./state.ts";
import type {
  ConfigValidationResult,
  ModelProfile,
  PersistedConfig,
  ProfileName,
  RouteSnapshot,
} from "./types.ts";

export function createModelProfileRuntime(pi: ExtensionAPI) {
  let configResult: ConfigValidationResult = { status: "missing" };
  let config: PersistedConfig | null = null;
  let activeProfile: ModelProfile | null = null;
  let activeProfileName: ProfileName | null = null;
  let warningShownThisSession = false;
  let routeSnapshot: RouteSnapshot | undefined;

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
        "Model profile configuration missing. Routing disabled; use /model-profile to set it up.",
        "warning",
      );
    } else if (configResult.status === "invalid") {
      const msg =
        configResult.errors.length > 0
          ? configResult.errors.join("; ")
          : "Unknown validation error";
      ctx.ui.notify(
        `Model profile configuration invalid: ${msg}. Routing disabled; use /model-profile to repair it.`,
        "warning",
      );
    }
  }

  function publishStatus(ctx: ExtensionContext): void {
    if (configResult.status === "missing") {
      ctx.ui.setStatus(
        "model-profile",
        ctx.ui.theme.fg("warning", "profile setup"),
      );
      return;
    }

    if (configResult.status === "invalid") {
      ctx.ui.setStatus(
        "model-profile",
        ctx.ui.theme.fg("warning", "profile invalid"),
      );
      return;
    }

    ctx.ui.setStatus(
      "model-profile",
      ctx.ui.theme.fg("dim", `profile ${activeProfileName}`),
    );
  }

  function publishFailedStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      "model-profile",
      ctx.ui.theme.fg("warning", "profile failed"),
    );
  }

  async function tryActivateDefault(ctx: ExtensionContext): Promise<boolean> {
    if (!configEnabled() || !activeProfile) return false;
    const activated = await activateRoute(pi, activeProfile.default, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate model '${activeProfile.default.model}' for profile '${activeProfileName}'; continuing with current model.`,
        "warning",
      );
    }
    return activated;
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
    markRouted: (snapshot: RouteSnapshot) => {
      routeSnapshot = snapshot;
    },
    hasRoutedSnapshot: () => routeSnapshot !== undefined,
    consumeRoutedSnapshot: () => {
      const snapshot = routeSnapshot;
      routeSnapshot = undefined;
      return snapshot;
    },
  };
}

export type ModelProfileRuntime = ReturnType<typeof createModelProfileRuntime>;
