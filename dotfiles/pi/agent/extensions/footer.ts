import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";

function formatCwd(cwd: string): string {
  if (cwd === process.env.HOME) {
    return "~";
  }

  return basename(cwd);
}

export default function (pi: ExtensionAPI) {
  let requestRender: (() => void) | null = null;

  pi.on("model_select", () => {
    requestRender?.();
  });

  pi.on("session_start", (_event, ctx) => {
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
            const modelId = ctx.model?.id;
            const separator = theme.fg("dim", " | ");
            const extStatuses = footerData.getExtensionStatuses();
            const order = ["context-usage", "codex-quota"];
            const ordered = order
              .map((k) => extStatuses.get(k))
              .filter(Boolean);
            const remaining = Array.from(extStatuses.entries())
              .filter(([k]) => !order.includes(k))
              .map(([, v]) => v);

            const sections = [
              theme.fg("dim", branch ? `${cwd} (${branch})` : cwd),
              theme.fg(
                "dim",
                modelId ? `${modelId} · ${thinking}` : `${thinking}`,
              ),
              ...ordered,
              ...remaining,
            ];

            const left = sections.join(separator);
            const right = theme.fg("dim", "·");
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
