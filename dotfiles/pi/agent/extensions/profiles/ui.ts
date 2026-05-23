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
  ProfileName,
  ThinkingLevel,
} from "./types.ts";
import { FIXED_PROFILE_NAMES, FIXED_ROUTE_NAMES } from "./types.ts";

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

function statusMessage(
  configStatus: ConfigValidationResult["status"],
  activeProfileName: ProfileName | null,
  theme: Theme,
): string {
  if (configStatus === "valid") {
    const activeText = activeProfileName
      ? ` Active: ${activeProfileName}.`
      : "";
    return theme.fg(
      "success",
      `Configuration ready.${activeText} Select a profile to edit, or press Space to activate.`,
    );
  }

  if (configStatus === "missing") {
    return theme.fg(
      "warning",
      "No profiles configured yet. Select a profile to start setup.",
    );
  }

  return theme.fg(
    "warning",
    "Configuration needs repair. Select a profile to fix missing values.",
  );
}

function renderProfileFrame(
  width: number,
  items: string[],
  selected: number,
  configStatus: ConfigValidationResult["status"],
  activeProfileName: ProfileName | null,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(renderBorder(width, theme));
  lines.push(theme.fg("accent", theme.bold("Profiles")));
  renderWrapped(
    lines,
    width,
    statusMessage(configStatus, activeProfileName, theme),
    theme,
  );
  lines.push("");

  for (const [i, item] of items.entries()) {
    const prefix =
      i === selected ? theme.fg("accent", `> ${i + 1}. `) : `  ${i + 1}. `;
    lines.push(truncateToWidth(prefix + item, width));
  }

  lines.push("");
  const hints =
    configStatus === "valid"
      ? "↑↓ navigate • Enter edit • Space activate • Esc close"
      : "↑↓ navigate • Enter edit • Esc close";
  lines.push(truncateToWidth(theme.fg("dim", hints), width));
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
  lines.push(theme.fg("accent", theme.bold(`Configuring: ${profileName}`)));
  renderWrapped(
    lines,
    width,
    "Edit each route's model and thinking level. Esc saves and returns when all routes are complete.",
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
      theme.fg("dim", "↑↓ navigate • Enter edit route • Esc save & return"),
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
  },
): Promise<ProfileListResult> {
  const items = FIXED_PROFILE_NAMES.map((name) =>
    name === options.activeProfileName ? `${name} (active)` : name,
  );

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
          options.activeProfileName,
          theme,
        );
        return cachedLines;
      },
      handleInput(data: string) {
        const selectedProfileName = FIXED_PROFILE_NAMES[selected]!;

        if (matchesKey(data, Key.up) && selected > 0) {
          selected--;
          refresh();
        } else if (matchesKey(data, Key.down) && selected < items.length - 1) {
          selected++;
          refresh();
        } else if (matchesKey(data, Key.enter)) {
          done({ action: "edit", profileName: selectedProfileName });
        } else if (matchesKey(data, Key.escape)) {
          done(null);
        } else if (matchesKey(data, Key.space)) {
          if (options.configStatus === "valid") {
            done({ action: "activate", profileName: selectedProfileName });
          } else {
            ctx.ui.notify(
              "Cannot activate: configuration is incomplete.",
              "warning",
            );
          }
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
    low: profileConfig?.low ?? { model: "", thinkingLevel: "medium" },
    medium: profileConfig?.medium ?? { model: "", thinkingLevel: "medium" },
    high: profileConfig?.high ?? { model: "", thinkingLevel: "medium" },
  };

  let routeBeingEdited: FixedRouteName = "low";

  async function pickModel(): Promise<string | null> {
    const selected = await ctx.ui.select(
      `Model for ${profileName}/${routeBeingEdited}:`,
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
      `Thinking for ${profileName}/${routeBeingEdited}:`,
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
          `Set a model for ${incomplete.join(", ")} before saving.`,
          "warning",
        );
        continue;
      }

      const fullConfig: PersistedConfig = {
        activeProfile: currentConfig?.activeProfile ?? profileName,
        profiles: {
          ...(currentConfig?.profiles ?? {}),
          [profileName]: {
            low: routes.low,
            medium: routes.medium,
            high: routes.high,
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
