import type { ExtensionContext } from "./types.js";

const FETCHING_MESSAGE = "Fetching quota…";

export async function withQuotaNotification<T>(
  ctx: ExtensionContext,
  operation: () => Promise<T>,
): Promise<T> {
  if (ctx.hasUI) {
    ctx.ui.notify(FETCHING_MESSAGE, "info");
  }
  return operation();
}
