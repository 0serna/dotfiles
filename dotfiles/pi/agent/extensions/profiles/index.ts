import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { compact } from "@earendil-works/pi-coding-agent";
import { runProfileCommand } from "./command.ts";
import { parseModelId } from "./model-ids.ts";
import { createProfileRouteSession } from "./route-session.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { createProfilesRuntime } from "./runtime.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createProfilesRuntime();
  const routeSession = createProfileRouteSession(pi, runtime);

  pi.on("session_start", async (_event, ctx) => {
    await routeSession.start(ctx);
  });

  pi.on("session_before_compact", async (event, ctx) => {
    if (!runtime.configEnabled()) return;
    const config = runtime.getConfig();
    if (!config) return;

    const routeType = (
      ROUTE_TYPES as Partial<Record<string, keyof typeof config>>
    )["/compact"];
    if (!routeType) return;
    const route = config[routeType];

    function warnFallback(message: string): void {
      ctx.ui.notify(
        `Compact route failed: ${message}. Falling back to default compaction.`,
        "warning",
      );
    }

    const [provider, modelId] = parseModelId(route.model);
    const model = ctx.modelRegistry.find(provider, modelId);
    if (!model) {
      warnFallback(`model '${route.model}' not found`);
      return;
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      warnFallback(`authentication unavailable for '${route.model}'`);
      return;
    }

    try {
      const result = await compact(
        event.preparation,
        model,
        auth.apiKey,
        auth.headers,
        event.customInstructions,
        event.signal,
        route.thinkingLevel,
      );
      return { compaction: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnFallback(message);
      return;
    }
  });

  pi.on("input", (event, ctx) => routeSession.routeInput(event, ctx));

  pi.on("agent_end", async (_event, ctx) => {
    await routeSession.finishAgent(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    routeSession.rememberModelSelection(event, ctx);
  });

  pi.on("thinking_level_select", (event, ctx) => {
    routeSession.rememberThinkingLevel(event, ctx);
  });

  pi.on("session_shutdown", () => {
    routeSession.shutdown();
  });

  pi.registerCommand("profile", {
    description: "Configure profile routes (model and thinking level)",
    handler: async (_args, ctx) => {
      await runProfileCommand(ctx, runtime);
    },
  });
}
