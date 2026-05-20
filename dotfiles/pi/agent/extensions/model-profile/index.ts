import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runModelProfileCommand } from "./command.ts";
import { ROUTE_TYPES } from "./profiles.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import { createModelProfileRuntime } from "./runtime.ts";
import type { RouteSnapshot } from "./types.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createModelProfileRuntime(pi);

  pi.on("session_start", async (_event, ctx) => {
    await runtime.refreshConfig(ctx);
    runtime.publishStatus(ctx);
    if (runtime.configEnabled()) {
      if (!(await runtime.tryActivateDefault(ctx))) {
        runtime.publishFailedStatus(ctx);
      }
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
    const route = runtime.getActiveProfile()?.[routeType];
    if (!route) return { action: "continue" };

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

    runtime.markRouted(snapshot);
    return { action: "continue" };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!runtime.hasRoutedSnapshot()) return;
    runtime.consumeRoutedSnapshot();

    if (!runtime.configEnabled()) return;

    const activeProfile = runtime.getActiveProfile();
    if (!activeProfile) return;

    const activated = await activateRoute(pi, activeProfile.default, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not restore default model '${activeProfile.default.model}' for profile '${runtime.getActiveProfileName()}'.`,
        "warning",
      );
    }
  });

  pi.on("model_select", (event) => {
    if (event.source === "set" || event.source === "cycle") {
      pi.setThinkingLevel("medium");
    }
  });

  pi.registerCommand("model-profile", {
    description:
      "Manage model profiles: select active profile or configure models/thinking",
    handler: async (_args, ctx) => {
      await runModelProfileCommand(pi, ctx, runtime);
    },
  });
}
