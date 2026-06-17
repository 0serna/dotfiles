import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { parseModelId } from "./model-ids.ts";
import type {
  ConfigValidationResult,
  FixedRouteName,
  PersistedConfig,
  ThinkingLevel,
} from "./types.ts";

const ALL_ROUTES: FixedRouteName[] = ["light", "high"];

function renderBorder(width: number, theme: Theme): string {
  return theme.fg("accent", "─".repeat(width));
}

function renderWrapped(
  lines: string[],
  width: number,
  text: string,
  theme: Theme,
) {
  lines.push(...wrapTextWithAnsi(theme.fg("text", text), width));
}

function renderRouteFrame(
  width: number,
  routeItems: string[],
  selected: number,
  configStatus: ConfigValidationResult["status"],
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(renderBorder(width, theme));
  lines.push(theme.fg("accent", theme.bold("Profile Routes")));

  if (configStatus === "missing") {
    renderWrapped(
      lines,
      width,
      "No configuration yet. Set up your routes below.",
      theme,
    );
  } else if (configStatus === "invalid") {
    renderWrapped(
      lines,
      width,
      "Configuration needs repair. Fix the missing values below.",
      theme,
    );
  } else {
    renderWrapped(
      lines,
      width,
      "Edit each route's model and thinking level. Esc saves when all routes are complete.",
      theme,
    );
  }

  lines.push("");
  lines.push(
    theme.fg(
      "muted",
      "  route      model                                         thinking",
    ),
  );

  for (const [i, item] of routeItems.entries()) {
    const prefix = i === selected ? theme.fg("accent", "> ") : "  ";
    lines.push(truncateToWidth(prefix + item, width));
  }

  lines.push("");
  lines.push(
    truncateToWidth(
      theme.fg("dim", "↑↓ navigate • Enter edit route • Esc save & return"),
      width,
    ),
  );
  lines.push(renderBorder(width, theme));
  return lines;
}

export async function editRoutes(
  ctx: ExtensionContext,
  currentConfig: PersistedConfig | null,
  models: string[],
  configStatus: ConfigValidationResult["status"],
): Promise<PersistedConfig | null> {
  const routes: PersistedConfig = {
    light: currentConfig?.light ?? { model: "", thinkingLevel: "medium" },
    high: currentConfig?.high ?? { model: "", thinkingLevel: "medium" },
  };

  let routeBeingEdited: FixedRouteName = "light";

  async function pickModel(): Promise<string | null> {
    const selected = await ctx.ui.select(
      `Model for ${routeBeingEdited}:`,
      models,
    );
    return selected ?? null;
  }

  async function pickThinking(modelStr: string): Promise<ThinkingLevel | null> {
    const [provider, modelId] = parseModelId(modelStr);
    const model = ctx.modelRegistry.find(provider, modelId);
    if (!model) {
      ctx.ui.notify(`Model '${modelStr}' not found.`, "warning");
      return null;
    }

    const levels = getSupportedThinkingLevels(model);
    if (levels.length === 0) {
      ctx.ui.notify(
        `No thinking levels available for '${modelStr}'.`,
        "warning",
      );
      return null;
    }
    const selected = await ctx.ui.select(
      `Thinking for ${routeBeingEdited}:`,
      levels,
    );
    return (selected as ThinkingLevel) ?? null;
  }

  while (true) {
    const routeItems = ALL_ROUTES.map((r) => {
      const rt = routes[r];
      const model = rt?.model || "[unset]";
      const think = rt?.model ? rt.thinkingLevel : "[unset]";
      return `${r.padEnd(10)} ${model.padEnd(45)} ${think}`;
    });

    const editResult = await ctx.ui.custom<FixedRouteName | null>(
      (tui, theme, _kb, done) => {
        let sel = ALL_ROUTES.indexOf(routeBeingEdited);
        let cachedLines: string[] | undefined;

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        return {
          render(width: number) {
            cachedLines ??= renderRouteFrame(
              width,
              routeItems,
              sel,
              configStatus,
              theme,
            );
            return cachedLines;
          },
          handleInput(data: string) {
            if (matchesKey(data, Key.up) && sel > 0) {
              sel--;
              refresh();
            } else if (
              matchesKey(data, Key.down) &&
              sel < ALL_ROUTES.length - 1
            ) {
              sel++;
              refresh();
            } else if (matchesKey(data, Key.enter)) {
              done(ALL_ROUTES[sel]!);
            } else if (matchesKey(data, Key.escape)) {
              done(null);
            }
          },
          invalidate() {
            cachedLines = undefined;
          },
        };
      },
    );

    if (editResult === null) {
      const incomplete = ALL_ROUTES.filter((r) => !routes[r]?.model);
      if (incomplete.length > 0) {
        ctx.ui.notify(
          `Set a model for ${incomplete.join(", ")} before saving.`,
          "warning",
        );
        continue;
      }

      return routes;
    }

    routeBeingEdited = editResult;

    const newModel = await pickModel();
    if (newModel === null) continue;

    const newThinking = await pickThinking(newModel);
    if (newThinking === null) continue;

    routes[routeBeingEdited] = {
      model: newModel,
      thinkingLevel: newThinking,
    };
  }
}
