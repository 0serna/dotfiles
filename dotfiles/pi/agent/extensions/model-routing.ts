import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type ModelSnapshot = NonNullable<Parameters<ExtensionAPI["setModel"]>[0]>;
type ModelRoute = {
  model: string;
  thinkingLevel: ThinkingLevel;
};

const DEFAULT_THINKING: ThinkingLevel = "medium";

const DEFAULT_MODEL: ModelRoute = {
  model: "openai-codex/gpt-5.5",
  thinkingLevel: "low",
};

const LIGHT_MODEL: ModelRoute = {
  model: "opencode-go/deepseek-v4-flash",
  thinkingLevel: "high",
};

const HEAVY_MODEL: ModelRoute = {
  model: "openai-codex/gpt-5.5",
  thinkingLevel: "medium",
};

const MODEL_ROUTES = {
  "/opsx-propose": HEAVY_MODEL,
  "/opsx-apply": LIGHT_MODEL,
  "/opsx-archive": LIGHT_MODEL,
  "/review": HEAVY_MODEL,
  "/simplify": LIGHT_MODEL,
  "/commit": LIGHT_MODEL,
} as const satisfies Record<string, ModelRoute>;

type RouteName = keyof typeof MODEL_ROUTES;

type RouteSnapshot = {
  model: ModelSnapshot | undefined;
  thinkingLevel: ThinkingLevel;
};

function getRouteName(input: string): RouteName | undefined {
  const [routeName] = input.trim().split(/\s+/);
  if (!routeName || !(routeName in MODEL_ROUTES)) return undefined;
  return routeName as RouteName;
}

function parseModelId(modelId: string): [provider: string, model: string] {
  const [provider = "", ...modelParts] = modelId.split("/");
  return [provider, modelParts.join("/")];
}

async function activateRoute(
  pi: ExtensionAPI,
  route: ModelRoute,
  ctx: ExtensionContext,
): Promise<boolean> {
  const [provider, modelId] = parseModelId(route.model);
  const model = ctx.modelRegistry.find(provider, modelId);
  const activated = model ? await pi.setModel(model) : false;
  if (!activated) return false;

  pi.setThinkingLevel(route.thinkingLevel);
  return true;
}

export default function (pi: ExtensionAPI) {
  let activeRouteSnapshot: RouteSnapshot | undefined;

  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "reload") return;

    const activated = await activateRoute(pi, DEFAULT_MODEL, ctx);
    if (!activated) {
      ctx.ui.notify(
        `Could not activate default model ${DEFAULT_MODEL.model}; continuing with the current model.`,
        "warning",
      );
    }
  });

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };

    const routeName = getRouteName(event.text);
    if (!routeName) return { action: "continue" };

    const route = MODEL_ROUTES[routeName];

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

    activeRouteSnapshot = snapshot;
    return { action: "continue" };
  });

  pi.on("agent_end", async () => {
    if (!activeRouteSnapshot) return;

    const snapshot = activeRouteSnapshot;
    activeRouteSnapshot = undefined;

    if (snapshot.model) {
      await pi.setModel(snapshot.model);
    }
    pi.setThinkingLevel(snapshot.thinkingLevel);
  });

  pi.on("model_select", (event) => {
    if (event.source === "set" || event.source === "cycle") {
      pi.setThinkingLevel(DEFAULT_THINKING);
    }
  });
}
