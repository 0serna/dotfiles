import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { validateConfigSemantics } from "./routing.ts";
import { loadConfig } from "./state.ts";
import type { ConfigValidationResult, PersistedConfig } from "./types.ts";

export function createProfilesRuntime() {
  let configResult: ConfigValidationResult = { status: "missing" };
  let config: PersistedConfig | null = null;
  let warningShownThisSession = false;

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
    return configResult.status === "valid";
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

  return {
    refreshConfig,
    configEnabled,
    warnOnce,
    getConfigResult: () => configResult,
    getConfig: () => config,
  };
}

export type ProfilesRuntime = ReturnType<typeof createProfilesRuntime>;
