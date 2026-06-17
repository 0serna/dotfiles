import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getModelLabels } from "./model-ids.ts";
import { validateConfigSemantics } from "./routing.ts";
import type { ProfilesRuntime } from "./runtime.ts";
import { saveConfig } from "./state.ts";
import { editRoutes } from "./ui.ts";

export async function runProfileCommand(
  ctx: ExtensionContext,
  runtime: ProfilesRuntime,
): Promise<void> {
  await runtime.refreshConfig(ctx);

  const availableModels = ctx.modelRegistry.getAvailable();
  if (availableModels.length === 0) {
    ctx.ui.notify("No models available. Configure API keys first.", "warning");
    return;
  }
  const modelLabels = getModelLabels(availableModels);

  const fullConfig = await editRoutes(
    ctx,
    runtime.getConfig(),
    modelLabels,
    runtime.getConfigResult().status,
  );
  if (fullConfig === null) return;

  const semanticErrors = await validateConfigSemantics(fullConfig, ctx);
  if (semanticErrors.length > 0) {
    ctx.ui.notify(`Cannot save: ${semanticErrors.join("; ")}`, "warning");
    return;
  }

  await saveConfig(fullConfig);
  await runtime.refreshConfig(ctx);
  ctx.ui.notify("Profile routes saved.", "info");
}
