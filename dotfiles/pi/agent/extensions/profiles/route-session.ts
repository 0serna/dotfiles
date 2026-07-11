import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { formatModelId } from "./model-ids.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import type { ProfilesRuntime } from "./runtime.ts";
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

type InputEvent = {
  source: string;
  text: string;
};

type ModelSelectEvent = {
  source: string;
};

type ThinkingLevelSelectEvent = {
  level: UserSelection["thinkingLevel"];
};

export function createProfileRouteSession(
  pi: ExtensionAPI,
  runtime: ProfilesRuntime,
) {
  let ignoreSelectionEvents = false;
  let routeActive = false;
  let activeModelId: string | undefined;

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
  ): Promise<boolean> {
    const model = ctx.modelRegistry.find(
      persisted.modelProvider,
      persisted.modelId,
    );
    if (!model) {
      ctx.ui.notify(
        `Could not restore user model '${persisted.modelProvider}/${persisted.modelId}'.`,
        "warning",
      );
      return false;
    }
    let restored = false;
    await ignoreSelectionEventsWhile(async () => {
      restored = await pi.setModel(model as Model<Api>);
      if (restored) pi.setThinkingLevel(persisted.thinkingLevel);
    });
    return restored;
  }

  async function start(ctx: ExtensionContext): Promise<void> {
    await loadMemory();
    const persisted = await loadUserSelection();

    if (persisted) {
      const restored = await restorePersistedUserSelection(ctx, persisted);
      if (restored && ctx.model) {
        recordLevel(formatModelId(ctx.model), pi.getThinkingLevel());
      }
    } else if (ctx.model) {
      await saveUserSelection({
        modelProvider: ctx.model.provider,
        modelId: ctx.model.id,
        thinkingLevel: pi.getThinkingLevel(),
      });
      recordLevel(formatModelId(ctx.model), pi.getThinkingLevel());
    }
    activeModelId = ctx.model ? formatModelId(ctx.model) : undefined;

    await runtime.refreshConfig(ctx);
    if (!runtime.configEnabled()) {
      await runtime.warnOnce(ctx);
    }
  }

  async function routeInput(
    event: InputEvent,
    ctx: ExtensionContext,
  ): Promise<{ action: "continue" }> {
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
  }

  async function finishAgent(ctx: ExtensionContext): Promise<void> {
    if (!routeActive) return;
    routeActive = false;
    const persisted = await loadUserSelection();
    if (persisted) {
      await restorePersistedUserSelection(ctx, persisted);
    }
    activeModelId = ctx.model ? formatModelId(ctx.model) : undefined;
  }

  function rememberModelSelection(
    event: ModelSelectEvent,
    ctx: ExtensionContext,
  ): void {
    if (!ctx.model) return;
    activeModelId = formatModelId(ctx.model);
    if (ignoreSelectionEvents) return;
    if (event.source !== "set" && event.source !== "cycle") return;

    const remembered = getRememberedLevel(activeModelId);
    if (remembered !== undefined) {
      pi.setThinkingLevel(remembered);
    }
    void saveUserSelection({
      modelProvider: ctx.model.provider,
      modelId: ctx.model.id,
      thinkingLevel: pi.getThinkingLevel(),
    });
  }

  function rememberThinkingLevel(
    event: ThinkingLevelSelectEvent,
    ctx: ExtensionContext,
  ): void {
    if (ignoreSelectionEvents || !ctx.model) return;

    const modelId = formatModelId(ctx.model);
    const modelChanged =
      activeModelId !== undefined && activeModelId !== modelId;
    activeModelId = modelId;
    if (modelChanged) return;

    recordLevel(modelId, event.level);
    void saveUserSelection({
      modelProvider: ctx.model.provider,
      modelId: ctx.model.id,
      thinkingLevel: event.level,
    });
  }

  function shutdown(): void {
    flushThinkingMemory();
  }

  return {
    start,
    routeInput,
    finishAgent,
    rememberModelSelection,
    rememberThinkingLevel,
    shutdown,
  };
}

export type ProfileRouteSession = ReturnType<typeof createProfileRouteSession>;
