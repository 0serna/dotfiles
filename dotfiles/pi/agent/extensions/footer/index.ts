import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { isTuiMode } from "../shared/mode.ts";
import { formatDirectorySegment, parseGitMetadata } from "./format.ts";

const LEFT_EXTENSION_ORDER = ["context", "quota"];
const RIGHT_EXTENSION_ORDER: string[] = [];

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
            const separator = theme.fg("dim", " · ");
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
              theme.fg("dim", directory),
              theme.fg(
                "dim",
                modelSlug ? `${modelSlug}/${thinking}` : thinking,
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
