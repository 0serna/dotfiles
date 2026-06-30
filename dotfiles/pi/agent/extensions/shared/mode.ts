import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function isTuiMode(ctx: ExtensionContext): boolean {
  const mode = (ctx as { mode?: string }).mode;
  return mode !== undefined ? mode === "tui" : ctx.hasUI;
}
