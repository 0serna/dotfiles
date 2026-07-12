import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isTuiMode } from "../shared/mode.ts";
import { getModelLabels } from "./model-ids.ts";
import type { ModelRoutesRuntime } from "./runtime.ts";
import { saveConfig } from "./state.ts";
import { editRoutes } from "./ui.ts";

export async function runModelRoutesCommand(
  ctx: ExtensionContext,
  runtime: ModelRoutesRuntime,
): Promise<void> {
  if (!isTuiMode(ctx)) {
    ctx.ui.notify(
      "Model route editor is only available in TUI mode.",
      "warning",
    );
    return;
  }

  await runtime.refreshConfig(ctx);

  const availableModels = ctx.modelRegistry.getAvailable();
  if (availableModels.length === 0) {
    ctx.ui.notify("No models available. Configure API keys first.", "warning");
    return;
  }
  const modelLabels = getModelLabels(availableModels);

  const result = await editRoutes(
    ctx,
    runtime.getConfigSnapshot(),
    modelLabels,
    runtime.getStatus(),
  );
  if (result === null) return;

  await saveConfig(result);
  await runtime.refreshConfig(ctx);
  ctx.ui.notify("Model routes saved.", "info");
}
