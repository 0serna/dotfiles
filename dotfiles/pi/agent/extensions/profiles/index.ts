import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runProfilesCommand } from "./command.ts";
import { COMPACT_ROUTE, ROUTE_TYPES } from "./profiles.ts";
import { activateRoute, getRouteName } from "./routing.ts";
import { createProfilesRuntime } from "./runtime.ts";
import type { RouteSnapshot } from "./types.ts";

export default function (pi: ExtensionAPI) {
  const runtime = createProfilesRuntime(pi);

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

    runtime.saveSnapshot(snapshot);
    return { action: "continue" };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!runtime.hasSnapshot()) return;
    runtime.consumeSnapshot();

    if (!runtime.configEnabled()) return;

    const activeProfile = runtime.getActiveProfile();
    if (!activeProfile) return;

    const activated = await activateRoute(pi, activeProfile.low, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not restore default model '${activeProfile.low.model}' for profile '${runtime.getActiveProfileName()}'.`,
        "warning",
      );
    }
  });

  pi.on("session_before_compact", async (_event, ctx) => {
    if (!runtime.configEnabled()) return;
    if (runtime.hasSnapshot()) return;

    const profile = runtime.getActiveProfile();
    if (!profile) return;

    const snapshot: RouteSnapshot = {
      model: ctx.model,
      thinkingLevel: pi.getThinkingLevel(),
    };

    const activated = await activateRoute(pi, profile[COMPACT_ROUTE], ctx);
    if (!activated) return;

    runtime.saveSnapshot(snapshot);
  });

  pi.on("session_compact", async (_event, ctx) => {
    if (!runtime.hasSnapshot()) return;

    const restored = await runtime.restoreSnapshot(ctx);
    if (!restored) {
      ctx.ui.notify(
        `Could not restore model after compaction; continuing with current model.`,
        "warning",
      );
    }
  });

  pi.on("model_select", (event) => {
    if (event.source === "set" || event.source === "cycle") {
      pi.setThinkingLevel("medium");
    }
  });

  pi.registerCommand("profiles", {
    description:
      "Manage profiles: select active profile or configure models/thinking",
    handler: async (_args, ctx) => {
      await runProfilesCommand(pi, ctx, runtime);
    },
  });
}
