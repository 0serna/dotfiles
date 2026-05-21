import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getModelLabels } from "./model-ids.ts";
import {
  activateRoute,
  getActiveProfile,
  validateConfigSemantics,
} from "./routing.ts";
import type { ProfilesRuntime } from "./runtime.ts";
import { saveConfig } from "./state.ts";
import { editProfileRoutes, showProfileList } from "./ui.ts";

export async function runProfilesCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  runtime: ProfilesRuntime,
): Promise<void> {
  await runtime.refreshConfig(ctx);
  runtime.publishStatus(ctx);
  let draftConfig = runtime.getConfig();

  const availableModels = ctx.modelRegistry.getAvailable();
  if (availableModels.length === 0) {
    ctx.ui.notify("No models available. Configure API keys first.", "warning");
    return;
  }
  const modelLabels = getModelLabels(availableModels);

  while (true) {
    const profileResult = await showProfileList(ctx, {
      activeProfileName: runtime.getActiveProfileName(),
      configStatus: runtime.getConfigResult().status,
      configEnabled: runtime.configEnabled(),
    });
    if (!profileResult) break;

    const { action, profileName } = profileResult;

    if (action === "activate") {
      const config = runtime.getConfig();
      const resolved = getActiveProfile(config);
      if (!resolved || resolved.name !== profileName) {
        if (config) {
          config.activeProfile = profileName;
          await saveConfig(config);
          await runtime.refreshConfig(ctx);
        }
      }

      const activeProfile = runtime.getActiveProfile();
      if (activeProfile) {
        const activated = await activateRoute(pi, activeProfile.default, ctx);
        if (!activated) {
          runtime.publishFailedStatus(ctx);
          ctx.ui.notify(
            `Could not activate model '${activeProfile.default.model}' for profile '${profileName}'; profile remains selected.`,
            "warning",
          );
          break;
        }
        runtime.publishStatus(ctx);
      }
      break;
    }

    const fullConfig = await editProfileRoutes(
      ctx,
      profileName,
      draftConfig,
      modelLabels,
    );
    if (fullConfig === null) continue;

    draftConfig = fullConfig;

    const semanticErrors = await validateConfigSemantics(fullConfig, ctx);
    if (semanticErrors.length > 0) {
      ctx.ui.notify(`Cannot save: ${semanticErrors.join("; ")}`, "warning");
      continue;
    }

    await saveConfig(fullConfig);
    await runtime.refreshConfig(ctx);
    draftConfig = runtime.getConfig();
    runtime.publishStatus(ctx);

    if (
      profileName === runtime.getActiveProfileName() &&
      runtime.getActiveProfile() &&
      !(await runtime.tryActivateDefault(ctx))
    ) {
      runtime.publishFailedStatus(ctx);
    }
  }
}
