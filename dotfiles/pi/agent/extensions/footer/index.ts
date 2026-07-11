import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";
import { isTuiMode } from "../shared/mode.ts";

function formatCwd(cwd: string): string {
  if (cwd === process.env.HOME) {
    return "~";
  }

  return basename(cwd);
}

const LEFT_EXTENSION_ORDER = ["context"];
const RIGHT_EXTENSION_ORDER = ["quota"];

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | null = null;

  pi.on("model_select", () => {
    requestRender?.();
  });

  pi.on("session_start", (_event, ctx) => {
    if (!isTuiMode(ctx)) return;

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
            const cwd = formatCwd(ctx.cwd);
            const branch = footerData.getGitBranch();
            const thinking = pi.getThinkingLevel();
            const modelLabel = ctx.model?.name ?? ctx.model?.id;
            const separator = theme.fg("dim", " | ");
            const extStatuses = footerData.getExtensionStatuses();
            const orderedExtensionKeys = new Set([
              ...LEFT_EXTENSION_ORDER,
              ...RIGHT_EXTENSION_ORDER,
            ]);
            const leftExtensions = [
              ...LEFT_EXTENSION_ORDER.map((key) => extStatuses.get(key)),
              ...Array.from(extStatuses.entries())
                .filter(([key]) => !orderedExtensionKeys.has(key))
                .map(([, status]) => status),
            ].filter(Boolean);
            const rightExtensions = RIGHT_EXTENSION_ORDER.map((key) =>
              extStatuses.get(key),
            ).filter(Boolean);

            const sections = [
              theme.fg("dim", branch ? `${cwd} › ${branch}` : cwd),
              theme.fg(
                "dim",
                modelLabel ? `${modelLabel} › ${thinking}` : thinking,
              ),
              ...leftExtensions,
            ].filter(Boolean);

            const left = sections.join(separator);
            const right =
              rightExtensions.join(separator) || theme.fg("dim", " ");
            const pad = " ".repeat(
              Math.max(1, width - visibleWidth(left) - visibleWidth(right)),
            );
            return [truncateToWidth(left + pad + right, width)];
          },
        };
      });
    } catch {
      // Footer setup failed, default footer remains
    }
  });
}
