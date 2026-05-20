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
  ModelRoute,
  PersistedConfig,
  ProfileName,
  ThinkingLevel,
} from "./types.ts";
import { FIXED_PROFILE_NAMES, FIXED_ROUTE_NAMES } from "./types.ts";

type ProfileListMode = ConfigValidationResult["status"];

export type ProfileListResult =
  | { action: "activate"; profileName: ProfileName }
  | { action: "edit"; profileName: ProfileName }
  | null;

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

function renderStatus(mode: ProfileListMode, theme: Theme): string {
  if (mode === "valid") return theme.fg("success", "ready");
  if (mode === "missing") return theme.fg("warning", "setup required");
  return theme.fg("warning", "repair required");
}

function renderProfileFrame(
  width: number,
  items: string[],
  selected: number,
  mode: ProfileListMode,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(renderBorder(width, theme));
  lines.push(theme.fg("accent", theme.bold("Model profiles")));
  renderWrapped(
    lines,
    width,
    `Status: ${renderStatus(mode, theme)}. Select a profile to activate or edit.`,
    theme,
  );
  lines.push("");

  for (const [i, item] of items.entries()) {
    const prefix =
      i === selected ? theme.fg("accent", `> ${i + 1}. `) : `  ${i + 1}. `;
    lines.push(truncateToWidth(prefix + item, width));
  }

  lines.push("");
  lines.push(
    truncateToWidth(
      mode === "valid"
        ? theme.fg(
            "dim",
            "↑↓ navigate • Enter activate • Space edit • Esc cancel",
          )
        : theme.fg("dim", "↑↓ navigate • Enter/Space edit • Esc cancel"),
      width,
    ),
  );
  lines.push(renderBorder(width, theme));
  return lines;
}

function renderRouteFrame(
  width: number,
  profileName: ProfileName,
  routeItems: string[],
  selected: number,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(renderBorder(width, theme));
  lines.push(theme.fg("accent", theme.bold(`Edit profile: ${profileName}`)));
  renderWrapped(
    lines,
    width,
    "Choose a route to edit its model and thinking level. Esc saves only when all routes are complete.",
    theme,
  );
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
      theme.fg(
        "dim",
        "↑↓ navigate • Enter edit selected route • Esc save & return",
      ),
      width,
    ),
  );
  lines.push(renderBorder(width, theme));
  return lines;
}

export async function showProfileList(
  ctx: ExtensionContext,
  options: {
    activeProfileName: ProfileName | null;
    configStatus: ConfigValidationResult["status"];
    configEnabled: boolean;
  },
): Promise<ProfileListResult> {
  const items = FIXED_PROFILE_NAMES.map((name) => {
    let label = name === options.activeProfileName ? `${name} (active)` : name;
    if (options.configStatus === "missing") label += "  [setup]";
    else if (options.configStatus === "invalid") label += "  [repair]";
    return label;
  });

  return ctx.ui.custom<ProfileListResult>((tui, theme, _kb, done) => {
    let selected = 0;
    let cachedLines: string[] | undefined;

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    return {
      render(width: number) {
        cachedLines ??= renderProfileFrame(
          width,
          items,
          selected,
          options.configStatus,
          theme,
        );
        return cachedLines;
      },
      handleInput(data: string) {
        if (matchesKey(data, Key.up) && selected > 0) {
          selected--;
          refresh();
        } else if (matchesKey(data, Key.down) && selected < items.length - 1) {
          selected++;
          refresh();
        } else if (matchesKey(data, Key.enter)) {
          done({
            action: options.configEnabled ? "activate" : "edit",
            profileName: FIXED_PROFILE_NAMES[selected]!,
          });
        } else if (matchesKey(data, Key.space)) {
          done({ action: "edit", profileName: FIXED_PROFILE_NAMES[selected]! });
        } else if (matchesKey(data, Key.escape)) {
          done(null);
        }
      },
      invalidate() {
        cachedLines = undefined;
      },
    };
  });
}

export async function editProfileRoutes(
  ctx: ExtensionContext,
  profileName: ProfileName,
  currentConfig: PersistedConfig | null,
  models: string[],
): Promise<PersistedConfig | null> {
  const profileConfig = currentConfig?.profiles?.[profileName];
  const routes: Record<
    FixedRouteName,
    { model: string; thinkingLevel: ThinkingLevel }
  > = {
    default: profileConfig?.default ?? { model: "", thinkingLevel: "medium" },
    light: profileConfig?.light ?? { model: "", thinkingLevel: "medium" },
    heavy: profileConfig?.heavy ?? { model: "", thinkingLevel: "medium" },
  };

  let routeBeingEdited: FixedRouteName = "default";

  async function pickModel(): Promise<string | null> {
    const selected = await ctx.ui.select(
      `Select model for ${profileName}/${routeBeingEdited}:`,
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
      `Select thinking level for ${profileName}/${routeBeingEdited}:`,
      levels,
    );
    return (selected as ThinkingLevel) ?? null;
  }

  while (true) {
    const routeItems = FIXED_ROUTE_NAMES.map((r) => {
      const rt = routes[r];
      const model = rt.model || "[unset]";
      const think = rt.model ? rt.thinkingLevel : "[unset]";
      return `${r.padEnd(10)} ${model.padEnd(45)} ${think}`;
    });

    const editResult = await ctx.ui.custom<string | null>(
      (tui, theme, _kb, done) => {
        let sel = FIXED_ROUTE_NAMES.indexOf(routeBeingEdited);
        let cachedLines: string[] | undefined;

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        return {
          render(width: number) {
            cachedLines ??= renderRouteFrame(
              width,
              profileName,
              routeItems,
              sel,
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
              sel < FIXED_ROUTE_NAMES.length - 1
            ) {
              sel++;
              refresh();
            } else if (matchesKey(data, Key.enter)) {
              done(FIXED_ROUTE_NAMES[sel]!);
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
      const incomplete = FIXED_ROUTE_NAMES.filter((r) => !routes[r].model);
      if (incomplete.length > 0) {
        ctx.ui.notify(
          `Cannot save: routes [${incomplete.join(", ")}] have no model selected.`,
          "warning",
        );
        continue;
      }

      const fullConfig: PersistedConfig = {
        activeProfile: currentConfig?.activeProfile ?? profileName,
        profiles: {
          ...(currentConfig?.profiles ?? {}),
          [profileName]: {
            default: routes.default as ModelRoute,
            light: routes.light as ModelRoute,
            heavy: routes.heavy as ModelRoute,
          },
        },
      };
      return fullConfig;
    }

    routeBeingEdited = editResult as FixedRouteName;

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
