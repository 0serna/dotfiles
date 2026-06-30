import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { compact } from "@earendil-works/pi-coding-agent";
import { runProfileCommand } from "./command.ts";
import { formatModelId, parseModelId } from "./model-ids.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import { createProfilesRuntime } from "./runtime.ts";
import {
  flushThinkingMemory,
  getRememberedLevel,
  loadMemory,
  recordLevel,
} from "./thinking-memory.ts";
import {
  loadUserSelection,
  saveUserSelection,
  type UserSelection,
} from "./user-selection.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createProfilesRuntime();
  let ignoreSelectionEvents = false;
  let routeActive = false;

  async function ignoreSelectionEventsWhile<T>(
    fn: () => Promise<T>,
  ): Promise<T> {
    ignoreSelectionEvents = true;
    try {
      return await fn();
    } finally {
      ignoreSelectionEvents = false;
    }
  }

  async function restorePersistedUserSelection(
    ctx: ExtensionContext,
    persisted: UserSelection,
  ): Promise<void> {
    const model = ctx.modelRegistry.find(
      persisted.modelProvider,
      persisted.modelId,
    );
    if (!model) {
      ctx.ui.notify(
        `Could not restore user model '${persisted.modelProvider}/${persisted.modelId}'.`,
        "warning",
      );
      return;
    }
    await ignoreSelectionEventsWhile(async () => {
      const ok = await pi.setModel(model as Model<Api>);
      if (ok) pi.setThinkingLevel(persisted.thinkingLevel);
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    await loadMemory();
    const persisted = await loadUserSelection();

    if (persisted) {
      await restorePersistedUserSelection(ctx, persisted);
    } else if (ctx.model) {
      await saveUserSelection({
        modelProvider: ctx.model.provider,
        modelId: ctx.model.id,
        thinkingLevel: pi.getThinkingLevel(),
      });
    }

    await runtime.refreshConfig(ctx);
    if (!runtime.configEnabled()) {
      await runtime.warnOnce(ctx);
    }
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

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    if (!runtime.configEnabled()) return { action: "continue" };

    const routeName = getRouteName(event.text);
    if (!routeName) return { action: "continue" };

    const routeType = ROUTE_TYPES[routeName];
    const config = runtime.getConfig();
    if (!config) return { action: "continue" };

    const route = config[routeType];

    const activated = await ignoreSelectionEventsWhile(() =>
      activateRoute(pi, route, ctx),
    );
    if (!activated) {
      ctx.ui.notify(
        `Could not activate routed model '${route.model}' for '${routeName}'; continuing with current model.`,
        "warning",
      );
      return { action: "continue" };
    }

    routeActive = true;
    return { action: "continue" };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!routeActive) return;
    routeActive = false;
    const persisted = await loadUserSelection();
    if (persisted) {
      await restorePersistedUserSelection(ctx, persisted);
    }
  });

  pi.on("model_select", (event, ctx) => {
    if (ignoreSelectionEvents) return;
    if (event.source !== "set" && event.source !== "cycle") return;
    if (!ctx.model) return;

    const remembered = getRememberedLevel(formatModelId(ctx.model));
    if (remembered !== undefined) {
      pi.setThinkingLevel(remembered);
    }
    void saveUserSelection({
      modelProvider: ctx.model.provider,
      modelId: ctx.model.id,
      thinkingLevel: pi.getThinkingLevel(),
    });
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (ignoreSelectionEvents || !ctx.model) return;
    recordLevel(formatModelId(ctx.model), event.level);
    void saveUserSelection({
      modelProvider: ctx.model.provider,
      modelId: ctx.model.id,
      thinkingLevel: event.level,
    });
  });

  pi.on("session_shutdown", () => {
    flushThinkingMemory();
  });

  pi.registerCommand("profile", {
    description: "Configure profile routes (model and thinking level)",
    handler: async (_args, ctx) => {
      await runProfileCommand(ctx, runtime);
    },
  });
}
