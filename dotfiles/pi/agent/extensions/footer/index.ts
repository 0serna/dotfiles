import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isTuiMode } from "../shared/mode.ts";
import {
  CONTEXT_USAGE_WARNING_TOKENS,
  formatCurrentUsage,
  formatDirectorySegment,
  parseGitMetadata,
} from "./format.ts";

const EXTENSION_ORDER = ["quota"];

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | null = null;

  pi.on("model_select", () => {
    requestRender?.();
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!isTuiMode(ctx)) return;

    const gitResult = await pi
      .exec(
        "git",
        [
          "rev-parse",
          "--show-toplevel",
          "--absolute-git-dir",
          "--git-common-dir",
        ],
        { cwd: ctx.cwd, timeout: 1_000 },
      )
      .catch(() => null);
    const git =
      gitResult?.code === 0 ? parseGitMetadata(gitResult.stdout) : null;

    try {
      ctx.ui.setFooter((tui, theme, footerData) => {
        requestRender = () => tui.requestRender();

        const unsubscribe = footerData.onBranchChange(() =>
          tui.requestRender(),
        );

        return {
          dispose: unsubscribe,
          invalidate() {},
          render(width: number): string[] {
            const branch = footerData.getGitBranch();
            const directory = formatDirectorySegment({
              cwd: ctx.cwd,
              home: process.env.HOME,
              branch,
              git,
            });
            const thinking = pi.getThinkingLevel();
            const modelSlug = ctx.model?.id;
            const separator = theme.fg("muted", " · ");
            const extStatuses = footerData.getExtensionStatuses();
            const orderedKeys = new Set(EXTENSION_ORDER);
            const extensions = [
              ...EXTENSION_ORDER.map((key) => extStatuses.get(key)),
              ...Array.from(extStatuses.entries())
                .filter(([key]) => !orderedKeys.has(key))
                .map(([, status]) => status),
            ].filter(Boolean);

            const usage = ctx.getContextUsage();
            const usageText = formatCurrentUsage(usage);
            const isOverLimit =
              (usage?.tokens ?? 0) > CONTEXT_USAGE_WARNING_TOKENS;
            const usageStyle = isOverLimit ? "warning" : "muted";
            const modelText = modelSlug ? `${modelSlug}/${thinking}` : thinking;
            const modelWithUsage = theme.fg(
              "muted",
              `${modelText} ${theme.fg(usageStyle, usageText)}`,
            );

            const dirLine = theme.fg("muted", directory);
            const extLine = extensions.join(separator);

            // Try 1 line
            const all = [dirLine, modelWithUsage, extLine]
              .filter(Boolean)
              .join(separator);
            if (visibleWidth(all) <= width) {
              return [truncateToWidth(all, width)];
            }

            // Try 2 lines: dir | model+ext
            const modelAndExt = [modelWithUsage, extLine]
              .filter(Boolean)
              .join(separator);
            if (visibleWidth(modelAndExt) <= width) {
              return [
                truncateToWidth(dirLine, width),
                truncateToWidth(modelAndExt, width),
              ];
            }

            // 3 lines: dir | model | ext
            return [
              truncateToWidth(dirLine, width),
              truncateToWidth(modelWithUsage, width),
              ...(extLine ? [truncateToWidth(extLine, width)] : []),
            ];
          },
        };
      });
    } catch {
      // Footer setup failed, default footer remains
    }
  });
}
