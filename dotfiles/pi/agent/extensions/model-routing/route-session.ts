import {
  parseSkillBlock,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  emptyManualPreferences,
  loadManualPreferences,
  saveManualPreferences,
  withSelection,
  type ManualPreferences,
  type ManualSelection,
} from "./manual-preferences.ts";
import { formatModelId, parseModelId } from "./model-ids.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import type { ModelRoutesRuntime } from "./runtime.ts";
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
  streamingBehavior?: "steer" | "followUp";
};

type MessageStartEvent = {
  message: {
    role: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
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

export function createModelRouteSession(
  pi: ExtensionAPI,
  runtime: ModelRoutesRuntime,
) {
  let routeActive = false;
  let activeRouteName: string | undefined;
  const queuedRouteBoundaries = new Map<string, number>();
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
        cancelActiveRoute();
      }
    }
  }

  function cancelActiveRoute(): void {
    routeActive = false;
    activeRouteName = undefined;
  }

  function queueRouteBoundary(routeName: string): void {
    const count = queuedRouteBoundaries.get(routeName) ?? 0;
    queuedRouteBoundaries.set(routeName, count + 1);
  }

  function consumeRouteBoundary(routeName: string): boolean {
    const count = queuedRouteBoundaries.get(routeName) ?? 0;
    if (count === 0) return false;
    if (count === 1) {
      queuedRouteBoundaries.delete(routeName);
    } else {
      queuedRouteBoundaries.set(routeName, count - 1);
    }
    return true;
  }

  async function restorePersistedUserSelection(
    ctx: ExtensionContext,
    persisted: ManualSelection,
  ): Promise<boolean> {
    const restoreError = `Could not restore user model '${persisted.modelProvider}/${persisted.modelId}'.`;
    const model = ctx.modelRegistry.find(
      persisted.modelProvider,
      persisted.modelId,
    );
    if (!model) {
      ctx.ui.notify(restoreError, "error");
      return false;
    }
    return suppressManualPersistenceWhile(async () => {
      const ok = await pi.setModel(model);
      if (ok) {
        pi.setThinkingLevel(persisted.thinkingLevel);
      } else {
        ctx.ui.notify(restoreError, "error");
      }
      return ok;
    });
  }

  async function start(ctx: ExtensionContext): Promise<void> {
    cancelActiveRoute();
    queuedRouteBoundaries.clear();
    preferences = await loadManualPreferences();
    transition = createTransitionState();
    pendingPersist = Promise.resolve();

    if (preferences.selection) {
      const restored = await restorePersistedUserSelection(
        ctx,
        preferences.selection,
      );
      if (restored && ctx.model) {
        preferences = withSelection(preferences, {
          modelProvider: ctx.model.provider,
          modelId: ctx.model.id,
          thinkingLevel: pi.getThinkingLevel(),
        });
        pendingPersist = saveManualPreferences(preferences);
      }
    } else if (ctx.model) {
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
    if (runtime.getStatus() !== "valid") {
      await runtime.warnOnce(ctx);
    }
  }

  async function activateRouteName(
    routeName: ReturnType<typeof getRouteName>,
    ctx: ExtensionContext,
  ): Promise<void> {
    if (!routeName || activeRouteName === routeName) return;

    if (!runtime.isRouteUsable(routeName)) {
      ctx.ui.notify(
        `Route '${routeName}' is not configured or unavailable; continuing with current model.`,
        "error",
      );
      return;
    }

    const route = runtime.getRouteConfig(routeName);
    if (!route) return;

    const activated = await suppressManualPersistenceWhile(() =>
      activateRoute(pi, route, ctx),
    );
    if (!activated) {
      ctx.ui.notify(
        `Could not activate routed model '${route.model}' for '${routeName}'; continuing with current model.`,
        "error",
      );
      return;
    }

    routeActive = true;
    activeRouteName = routeName;

    const modelId = parseModelId(route.model)[1];
    ctx.ui.notify(`🤖 route to ${modelId}/${route.thinkingLevel}`, "warning");
  }

  async function routeInput(
    event: InputEvent,
    ctx: ExtensionContext,
  ): Promise<{ action: "continue" }> {
    if (event.source === "extension") return { action: "continue" };

    const routeName = getRouteName(event.text);
    if (!routeName) return { action: "continue" };
    if (event.streamingBehavior !== undefined) {
      queueRouteBoundary(routeName);
      return { action: "continue" };
    }

    await activateRouteName(routeName, ctx);
    return { action: "continue" };
  }

  async function routeMessageStart(
    event: MessageStartEvent,
    ctx: ExtensionContext,
  ): Promise<void> {
    if (event.message.role !== "user") return;
    const content = event.message.content;
    const text =
      typeof content === "string"
        ? content
        : content?.find((block) => block.type === "text")?.text;
    if (!text) return;

    const skill = parseSkillBlock(text);
    if (!skill) return;
    const routeName = getRouteName(`/skill:${skill.name}`);
    if (!routeName || !consumeRouteBoundary(routeName)) return;
    await activateRouteName(routeName, ctx);
  }

  async function finishProcessingCycle(ctx: ExtensionContext): Promise<void> {
    if (!ctx.isIdle()) return;
    queuedRouteBoundaries.clear();
    if (!routeActive) return;

    const latest = await loadManualPreferences();
    preferences = latest;
    if (latest.selection) {
      const restored = await restorePersistedUserSelection(
        ctx,
        latest.selection,
      );
      if (restored && ctx.model) {
        ctx.ui.notify(
          `🤖 back to ${ctx.model.id}/${pi.getThinkingLevel()}`,
          "warning",
        );
      }
    }
    cancelActiveRoute();
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
    cancelActiveRoute();
    queuedRouteBoundaries.clear();
    // Writes go through the FIFO queue in manual-preferences and resolve in
    // submission order. By the time Pi calls session_shutdown the in-flight
    // promise chain has either settled or will be ignored on exit; there is
    // no debounced state left to flush.
  }

  return {
    start,
    routeInput,
    routeMessageStart,
    finishProcessingCycle,
    rememberModelSelection,
    rememberThinkingLevel,
    shutdown,
  };
}
