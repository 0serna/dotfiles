import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runProfileCommand } from "./command.ts";
import { DEFAULT_ROUTE, ROUTE_TYPES } from "./routes.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import { createProfilesRuntime } from "./runtime.ts";
import type { RouteSnapshot } from "./types.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createProfilesRuntime(pi);

  pi.on("session_start", async (_event, ctx) => {
    await runtime.refreshConfig(ctx);
    if (runtime.configEnabled()) {
      await runtime.tryActivateDefault(ctx);
    } else {
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

    const snapshot: RouteSnapshot = {
      model: ctx.model,
      thinkingLevel: pi.getThinkingLevel(),
    };

    const activated = await activateRoute(pi, route, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate routed model '${route.model}' for '${routeName}'; continuing with current model.`,
        "warning",
      );
      return { action: "continue" };
    }

    runtime.saveSnapshot(snapshot);
    return { action: "continue" };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!runtime.hasSnapshot()) return;
    runtime.consumeSnapshot();

    if (!runtime.configEnabled()) return;

    const config = runtime.getConfig();
    if (!config) return;

    const defaultRoute = config[DEFAULT_ROUTE];
    const activated = await activateRoute(pi, defaultRoute, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not restore default model '${defaultRoute.model}'.`,
        "warning",
      );
    }
  });

  pi.on("model_select", (event) => {
    if (event.source === "set" || event.source === "cycle") {
      pi.setThinkingLevel("medium");
    }
  });

  pi.registerCommand("profile", {
    description: "Configure profile routes (model and thinking level)",
    handler: async (_args, ctx) => {
      await runProfileCommand(pi, ctx, runtime);
    },
  });
}
