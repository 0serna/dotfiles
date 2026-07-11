import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  emptyManualPreferences,
  loadManualPreferences,
  saveManualPreferences,
  withSelection,
  type ManualPreferences,
  type ManualSelection,
} from "./manual-preferences.ts";
import { formatModelId } from "./model-ids.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import type { ProfilesRuntime } from "./runtime.ts";
import {
  createTransitionState,
  reduceTransition,
  type ModelSelectionSource,
  type TransitionEffect,
  type TransitionState,
  type TransitionView,
} from "./selection-transition.ts";
import type { ThinkingLevel } from "./types.ts";

type InputEvent = {
  source: string;
  text: string;
};

type ModelSelectEvent = {
  source: string;
};

type ThinkingLevelSelectEvent = {
  level: ThinkingLevel;
};

function sourceFromString(source: string): ModelSelectionSource {
  if (source === "set" || source === "cycle") return source;
  return "other";
}

export function createProfileRouteSession(
  pi: ExtensionAPI,
  runtime: ProfilesRuntime,
) {
  let routeActive = false;
  let transition: TransitionState = createTransitionState();
  let preferences: ManualPreferences = emptyManualPreferences();
  let pendingPersist: Promise<void> = Promise.resolve();

  /**
   * Run a function while selection events are considered automatic and
   * must not be persisted as manual preferences. Used around route
   * activation, route restoration, and session-start restoration.
   */
  async function suppressManualPersistenceWhile<T>(
    fn: () => Promise<T>,
  ): Promise<T> {
    const release = reduceTransition(
      transition,
      {
        kind: "suppress_manual_persistence",
      },
      memoryView(),
    );
    transition = release.state;
    try {
      return await fn();
    } finally {
      const reenable = reduceTransition(
        transition,
        {
          kind: "release_manual_persistence",
        },
        memoryView(),
      );
      transition = reenable.state;
    }
  }

  function memoryView(): TransitionView {
    return {
      getRememberedLevel: (modelId) => preferences.thinkingMemory[modelId],
    };
  }

  function schedulePersist(
    provider: string,
    modelId: string,
    thinkingLevel: ThinkingLevel,
  ): void {
    const selection: ManualSelection = {
      modelProvider: provider,
      modelId,
      thinkingLevel,
    };
    preferences = withSelection(preferences, selection);
    pendingPersist = saveManualPreferences(preferences);
  }

  function dispatchEffects(effects: TransitionEffect[]): void {
    for (const effect of effects) {
      if (effect.kind === "apply_thinking_level") {
        pi.setThinkingLevel(effect.level);
        continue;
      }
      if (effect.kind === "persist_selection") {
        schedulePersist(effect.provider, effect.modelId, effect.thinkingLevel);
      }
    }
  }

  async function restorePersistedUserSelection(
    ctx: ExtensionContext,
    persisted: ManualSelection,
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
    return suppressManualPersistenceWhile(async () => {
      const ok = await pi.setModel(model as Model<Api>);
      if (ok) pi.setThinkingLevel(persisted.thinkingLevel);
      return ok;
    });
  }

  async function start(ctx: ExtensionContext): Promise<void> {
    preferences = await loadManualPreferences();
    transition = createTransitionState();
    pendingPersist = Promise.resolve();

    if (preferences.selection) {
      const restored = await restorePersistedUserSelection(
        ctx,
        preferences.selection,
      );
      if (restored && ctx.model) {
        // The selection is restored under suppression, so the reducer
        // does not persist again. Update the in-memory memory entry to
        // reflect what Pi actually settled on so future manual picks
        // resolve correctly.
        preferences = withSelection(preferences, {
          modelProvider: ctx.model.provider,
          modelId: ctx.model.id,
          thinkingLevel: pi.getThinkingLevel(),
        });
      }
    } else if (ctx.model) {
      // First start with no persisted selection: persist the current
      // state so a later restart can restore it.
      preferences = withSelection(preferences, {
        modelProvider: ctx.model.provider,
        modelId: ctx.model.id,
        thinkingLevel: pi.getThinkingLevel(),
      });
      pendingPersist = saveManualPreferences(preferences);
    }
    transition = {
      ...transition,
      activeModelId: ctx.model ? formatModelId(ctx.model) : undefined,
    };

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

    const activated = await suppressManualPersistenceWhile(() =>
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
    // Refresh from disk in case another Pi instance changed the
    // selection while the route was active.
    const latest = await loadManualPreferences();
    preferences = latest;
    if (latest.selection) {
      await restorePersistedUserSelection(ctx, latest.selection);
    }
    transition = {
      ...transition,
      activeModelId: ctx.model ? formatModelId(ctx.model) : undefined,
    };
    await pendingPersist;
  }

  function rememberModelSelection(
    event: ModelSelectEvent,
    ctx: ExtensionContext,
  ): void {
    if (!ctx.model) return;
    const result = reduceTransition(
      transition,
      {
        kind: "model_selected",
        source: sourceFromString(event.source),
        provider: ctx.model.provider,
        modelId: ctx.model.id,
        currentLevel: pi.getThinkingLevel(),
      },
      memoryView(),
    );
    transition = result.state;
    dispatchEffects(result.effects);
  }

  function rememberThinkingLevel(
    event: ThinkingLevelSelectEvent,
    ctx: ExtensionContext,
  ): void {
    if (!ctx.model) return;
    const result = reduceTransition(
      transition,
      {
        kind: "thinking_level_selected",
        level: event.level,
        provider: ctx.model.provider,
        modelId: ctx.model.id,
      },
      memoryView(),
    );
    transition = result.state;
    dispatchEffects(result.effects);
  }

  function shutdown(): void {
    // Writes go through the FIFO queue in manual-preferences and resolve in
    // submission order. By the time Pi calls session_shutdown the in-flight
    // promise chain has either settled or will be ignored on exit; there is
    // no debounced state left to flush.
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
