import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { compact } from "@earendil-works/pi-coding-agent";
import { runModelRoutesCommand } from "./command.ts";
import { parseModelId } from "./model-ids.ts";
import { createModelRouteSession } from "./route-session.ts";
import { createModelRoutesRuntime } from "./runtime.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createModelRoutesRuntime();
  const routeSession = createModelRouteSession(pi, runtime);

  pi.on("session_start", async (_event, ctx) => {
    await routeSession.start(ctx);
  });

  pi.on("session_before_compact", async (event, ctx) => {
    if (!runtime.isRouteUsable("/compact")) {
      // Nothing configured or the configured model is unknown,
      // unsupported, or temporarily without credentials. Let Pi fall
      // back to its default compaction. Warn only when the user has
      // actually tried to configure the route, to avoid noise on
      // first-time sessions.
      const activation = runtime.getActivation();
      if (activation["/compact"].kind !== "unset") {
        ctx.ui.notify(
          "Compact route unavailable; falling back to default compaction.",
          "warning",
        );
      }
      return;
    }

    const route = runtime.getRouteConfig("/compact");
    if (!route) return;

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

  pi.registerCommand("model-routes", {
    description: "Configure model routes for slash commands and /compact",
    handler: async (_args, ctx) => {
      await runModelRoutesCommand(ctx, runtime);
    },
  });
}
