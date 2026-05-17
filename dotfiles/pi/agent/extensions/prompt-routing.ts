import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROMPT_ROUTES = {
  "/simplify": {
    model: "opencode-go/deepseek-v4-flash",
    thinkingLevel: "high",
  },
  "/review": {
    model: "opencode-go/deepseek-v4-flash",
    thinkingLevel: "high",
  },
  "/commit": {
    model: "opencode-go/deepseek-v4-flash",
    thinkingLevel: "high",
  },
  "/opsx-archive": {
    model: "opencode-go/deepseek-v4-flash",
    thinkingLevel: "high",
  },
} as const;

type PromptName = keyof typeof PROMPT_ROUTES;
type ModelSnapshot = NonNullable<Parameters<ExtensionAPI["setModel"]>[0]>;
type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;

type RouteSnapshot = {
  model: ModelSnapshot | undefined;
  thinkingLevel: ThinkingLevel;
};

function getPromptName(input: string): PromptName | undefined {
  const [promptName] = input.trim().split(/\s+/);
  if (!promptName) return undefined;
  if (!(promptName in PROMPT_ROUTES)) return undefined;

  return promptName as PromptName;
}

function parseModelId(modelId: string): [provider: string, model: string] {
  const [provider, ...modelParts] = modelId.split("/");
  return [provider ?? "", modelParts.join("/")];
}

export default function (pi: ExtensionAPI) {
  let activeRouteSnapshot: RouteSnapshot | undefined;

  pi.on("input", async (event, ctx) => {
    const promptName = getPromptName(event.text);
    if (!promptName) return { action: "continue" };

    const route = PROMPT_ROUTES[promptName];

    const snapshot: RouteSnapshot = {
      model: ctx.model,
      thinkingLevel: pi.getThinkingLevel(),
    };

    const [provider, modelId] = parseModelId(route.model);
    const model = ctx.modelRegistry.find(provider, modelId);
    const activated = model ? await pi.setModel(model) : false;
    if (!activated) {
      ctx.ui.notify(
        `Could not activate routed model ${route.model} for ${promptName}; continuing with the current model.`,
        "warning",
      );
      return { action: "continue" };
    }

    pi.setThinkingLevel(route.thinkingLevel);
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
}
