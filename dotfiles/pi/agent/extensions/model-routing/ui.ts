import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { parseModelId } from "./model-ids.ts";
import { ROUTE_TOKENS, type RouteName } from "./routes.ts";
import type { ModelRoutesConfig, ThinkingLevel } from "./types.ts";

const COLUMN_LABELS = {
  route: "route",
  model: "model",
  thinking: "thinking",
} as const;

// The route and thinking columns are sized to fit both their header
// label and their widest value; the model column flexes to absorb the
// remaining width so the frame fits narrow terminals instead of overflowing.
const ROUTE_COLUMN_WIDTH = Math.max(
  COLUMN_LABELS.route.length,
  ...ROUTE_TOKENS.map((token) => token.length),
);
const THINKING_COLUMN_WIDTH = Math.max(
  COLUMN_LABELS.thinking.length,
  "[unset]".length,
);
const MIN_MODEL_COLUMN_WIDTH = "[unset]".length;

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

export function renderRouteFrame(
  width: number,
  rows: { token: RouteName; model: string; thinking: string }[],
  selected: number,
  status: "valid" | "missing" | "invalid",
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(renderBorder(width, theme));
  lines.push(theme.fg("accent", theme.bold("Model Routes")));

  if (status === "missing") {
    renderWrapped(
      lines,
      width,
      "No configuration yet. Pick a model and thinking level for each route you want to use; unset routes are skipped.",
      theme,
    );
  } else if (status === "invalid") {
    renderWrapped(
      lines,
      width,
      "The on-disk configuration could not be parsed. Build a new one below; the original file is preserved.",
      theme,
    );
  } else {
    renderWrapped(
      lines,
      width,
      "Edit each route's model and thinking level. Unset routes are skipped at runtime; Esc saves whatever is configured.",
      theme,
    );
  }

  lines.push("");

  // Columns are left-aligned. The route and thinking columns are sized
  // to fit their header label and widest value; the model column takes
  // the longest model in the current rows (capped so the whole line
  // still fits). This keeps the thinking column immediately after the
  // model instead of pushing it to the right edge.
  const PREFIX_WIDTH = 2;
  const GAP_WIDTH = 1;
  const modelContentWidth = Math.max(
    MIN_MODEL_COLUMN_WIDTH,
    ...rows.map((row) => row.model.length),
  );
  const remainingWidth =
    width -
    PREFIX_WIDTH -
    ROUTE_COLUMN_WIDTH -
    GAP_WIDTH -
    THINKING_COLUMN_WIDTH -
    GAP_WIDTH;
  const modelColumnWidth = Math.max(
    MIN_MODEL_COLUMN_WIDTH,
    Math.min(modelContentWidth, remainingWidth),
  );

  const header =
    " ".repeat(PREFIX_WIDTH) +
    COLUMN_LABELS.route.padEnd(ROUTE_COLUMN_WIDTH) +
    " ".repeat(GAP_WIDTH) +
    COLUMN_LABELS.model.padEnd(modelColumnWidth) +
    " ".repeat(GAP_WIDTH) +
    COLUMN_LABELS.thinking;
  lines.push(truncateToWidth(theme.fg("muted", header), width));

  for (const [i, row] of rows.entries()) {
    const prefix = i === selected ? theme.fg("accent", "> ") : "  ";
    const item =
      row.token.padEnd(ROUTE_COLUMN_WIDTH) +
      " ".repeat(GAP_WIDTH) +
      row.model.padEnd(modelColumnWidth) +
      " ".repeat(GAP_WIDTH) +
      row.thinking;
    lines.push(truncateToWidth(prefix + item, width));
  }

  lines.push("");
  lines.push(
    truncateToWidth(
      theme.fg(
        "dim",
        "↑↓ navigate • Enter edit • Delete unset • Esc save & return",
      ),
      width,
    ),
  );
  lines.push(renderBorder(width, theme));
  return lines;
}

type EditResult =
  | { kind: "edit"; token: RouteName }
  | { kind: "unset"; token: RouteName };

/**
 * Open the route editor. Returns the (partial) configuration on save,
 * or `null` when the user cancelled. Unset routes are kept absent in
 * the returned shape; the caller omits them on disk.
 */
export async function editRoutes(
  ctx: ExtensionContext,
  currentConfig: ModelRoutesConfig,
  models: string[],
  configStatus: "valid" | "missing" | "invalid",
): Promise<ModelRoutesConfig | null> {
  // Working copy seeded from the persisted config. Missing keys are
  // `[unset]` here, represented by omission.
  const working: ModelRoutesConfig = { ...currentConfig };

  function renderRow(token: RouteName): {
    token: RouteName;
    model: string;
    thinking: string;
  } {
    const configured = working[token];
    const model = configured?.model ?? "[unset]";
    const thinking = configured?.model ? configured.thinkingLevel : "[unset]";
    return { token, model, thinking };
  }

  async function pickModel(token: RouteName): Promise<string | null> {
    const selected = await ctx.ui.select(`Model for ${token}:`, models);
    return selected ?? null;
  }

  async function pickThinking(
    token: RouteName,
    modelStr: string,
  ): Promise<ThinkingLevel | null> {
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
    const selected = await ctx.ui.select(`Thinking for ${token}:`, levels);
    return (selected as ThinkingLevel) ?? null;
  }

  async function confirmUnset(token: RouteName): Promise<boolean> {
    return await ctx.ui.confirm(
      `Unset ${token}?`,
      "It will be omitted from saved configuration.",
    );
  }

  while (true) {
    const rows = ROUTE_TOKENS.map(renderRow);

    const editResult = await ctx.ui.custom<EditResult | null>(
      (tui, theme, _kb, done) => {
        let sel = 0;
        let cachedLines: string[] | undefined;

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        return {
          render(width: number) {
            cachedLines ??= renderRouteFrame(
              width,
              rows,
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
              sel < ROUTE_TOKENS.length - 1
            ) {
              sel++;
              refresh();
            } else if (matchesKey(data, Key.enter)) {
              done({ kind: "edit", token: ROUTE_TOKENS[sel]! });
            } else if (
              matchesKey(data, Key.delete) ||
              matchesKey(data, Key.backspace)
            ) {
              done({ kind: "unset", token: ROUTE_TOKENS[sel]! });
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
      return working;
    }

    if (editResult.kind === "unset") {
      const ok = await confirmUnset(editResult.token);
      if (ok) delete working[editResult.token];
      continue;
    }

    const token = editResult.token;
    const newModel = await pickModel(token);
    if (newModel === null) continue;

    const newThinking = await pickThinking(token, newModel);
    if (newThinking === null) continue;

    working[token] = {
      model: newModel,
      thinkingLevel: newThinking,
    };
  }
}
