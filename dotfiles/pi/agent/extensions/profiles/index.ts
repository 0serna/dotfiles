import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { runProfileCommand } from "./command.ts";
import { formatModelId } from "./model-ids.ts";
import { ROUTE_TYPES } from "./routes.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import { createProfilesRuntime } from "./runtime.ts";
import {
  getRememberedLevel,
  loadMemory,
  recordLevel,
} from "./thinking-memory.ts";
import type { ThinkingLevel } from "./types.ts";

type UserSnapshot = {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
};

export default function (pi: ExtensionAPI) {
  const runtime = createProfilesRuntime();
  let userSnapshot: UserSnapshot | undefined;
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

  async function restoreUserSnapshot(ctx: ExtensionContext): Promise<void> {
    if (!userSnapshot) return;
    const snapshot = userSnapshot;
    const restored = await ignoreSelectionEventsWhile(async () => {
      const ok = await pi.setModel(snapshot.model);
      if (ok) pi.setThinkingLevel(snapshot.thinkingLevel);
      return ok;
    });
    if (!restored) {
      ctx.ui.notify(
        `Could not restore user model '${formatModelId(snapshot.model)}'.`,
        "warning",
      );
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    await loadMemory();
    if (ctx.model) {
      userSnapshot = { model: ctx.model, thinkingLevel: pi.getThinkingLevel() };
    }
    await runtime.refreshConfig(ctx);
    if (!runtime.configEnabled()) {
      await runtime.warnOnce(ctx);
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
    await restoreUserSnapshot(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    if (ignoreSelectionEvents) return;
    if (event.source !== "set" && event.source !== "cycle") return;
    if (!ctx.model) return;

    const remembered = getRememberedLevel(formatModelId(ctx.model));
    if (remembered !== undefined) {
      pi.setThinkingLevel(remembered);
    }
    userSnapshot = { model: ctx.model, thinkingLevel: pi.getThinkingLevel() };
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (ignoreSelectionEvents || !ctx.model) return;
    recordLevel(formatModelId(ctx.model), event.level);
    userSnapshot = { model: ctx.model, thinkingLevel: event.level };
  });

  pi.registerCommand("profile", {
    description: "Configure profile routes (model and thinking level)",
    handler: async (_args, ctx) => {
      await runProfileCommand(ctx, runtime);
    },
  });
}
