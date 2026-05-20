import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";

function formatCwd(cwd: string): string {
  if (cwd === process.env.HOME) {
    return "~";
  }

  return basename(cwd);
}

const EXCLUDED_EXTENSIONS = new Set([
  "context-usage",
  "model-profile",
  "quota",
]);

function formatCwdWithBranch(
  cwd: string,
  branch: string | null,
  theme: Theme,
): string {
  return theme.fg("dim", branch ? `${cwd} (${branch})` : cwd);
}

function formatModelInfo(
  modelId: string | null | undefined,
  provider: string | null | undefined,
  thinking: string,
  theme: Theme,
): string {
  const modelInfo = modelId && provider ? `${provider}/${modelId}` : modelId;
  return theme.fg("dim", modelInfo ? `${modelInfo} ${thinking}` : thinking);
}

function getRightSide(
  usageQuota: string | undefined,
  fallback: string,
): string {
  return usageQuota ?? fallback;
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
            const provider = ctx.model?.provider;
            const separator = theme.fg("dim", " | ");
            const extStatuses = footerData.getExtensionStatuses();
            const usageQuota = extStatuses.get("quota");
            const profileStatus = extStatuses.get("model-profile");
            const ordered = [extStatuses.get("context-usage")].filter(Boolean);
            const remaining = Array.from(extStatuses.entries())
              .filter(([k]) => !EXCLUDED_EXTENSIONS.has(k))
              .map(([, v]) => v);

            const sections = [
              formatCwdWithBranch(cwd, branch, theme),
              profileStatus,
              formatModelInfo(modelId, provider, thinking, theme),
              ...ordered,
              ...remaining,
            ].filter(Boolean);

            const left = sections.join(separator);
            const right = getRightSide(usageQuota, theme.fg("dim", " "));
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
