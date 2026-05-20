import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_THINKING,
  FALLBACK_PROFILE,
  PROFILES,
  ROUTE_TYPES,
  type ProfileName,
} from "./profiles.ts";
import {
  activateRoute,
  getRouteName,
  resolveActiveProfile,
} from "./routing.ts";
import { readState, writeState } from "./state.ts";
import type { ModelProfile, RouteSnapshot } from "./types.ts";

export default function (pi: ExtensionAPI) {
  let activeProfile: ModelProfile = PROFILES[FALLBACK_PROFILE];
  let activeProfileName: ProfileName = FALLBACK_PROFILE;
  let routeSnapshot: RouteSnapshot | undefined;

  async function loadAndActivateDefault(ctx: ExtensionContext) {
    const state = await readState();
    activeProfile = resolveActiveProfile(state);
    activeProfileName =
      (Object.keys(PROFILES) as ProfileName[]).find(
        (n) => PROFILES[n] === activeProfile,
      ) ?? FALLBACK_PROFILE;

    const activated = await activateRoute(pi, activeProfile.default, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate default model ${activeProfile.default.model} for current profile; continuing with the current model.`,
        "warning",
      );
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    await loadAndActivateDefault(ctx);
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };

    const routeName = getRouteName(event.text);
    if (!routeName) return { action: "continue" };

    const routeType = ROUTE_TYPES[routeName];
    const route = activeProfile[routeType];

    const snapshot: RouteSnapshot = {
      model: ctx.model,
      thinkingLevel: pi.getThinkingLevel(),
    };

    const activated = await activateRoute(pi, route, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate routed model ${route.model} for ${routeName}; continuing with the current model.`,
        "warning",
      );
      return { action: "continue" };
    }

    routeSnapshot = snapshot;
    return { action: "continue" };
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!routeSnapshot) return;

    routeSnapshot = undefined;

    const activated = await activateRoute(pi, activeProfile.default, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate default model ${activeProfile.default.model} after routed command.`,
        "warning",
      );
    }
  });

  pi.on("model_select", (event) => {
    if (event.source === "set" || event.source === "cycle") {
      pi.setThinkingLevel(DEFAULT_THINKING);
    }
  });

  pi.registerCommand("model-profile", {
    description: "Select an active model profile interactively",
    handler: async (_args, ctx) => {
      const profileNames = Object.keys(PROFILES) as ProfileName[];
      const items = profileNames.map((n) =>
        n === activeProfileName ? `${n} (active)` : n,
      );
      const selected = await ctx.ui.select("Select model profile:", items);
      if (!selected) return;

      const profileName = selected.replace(/ \(active\)$/, "") as ProfileName;
      const profile = PROFILES[profileName];

      await writeState(profileName);
      activeProfile = profile;
      activeProfileName = profileName;

      const activated = await activateRoute(pi, profile.default, ctx);
      if (!activated) {
        ctx.ui.notify(
          `Could not activate default model for profile "${profileName}"; profile remains selected.`,
          "warning",
        );
      }
    },
  });
}
