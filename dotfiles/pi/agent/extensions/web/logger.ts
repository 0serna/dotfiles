import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.ts";

let logger: ExtensionLogger;

export function configureWebToolsLogger(ctx: ExtensionContext): void {
  logger = createExtensionLogger(ctx, "web");
}

export function logWebToolEvent(
  event: string,
  data: Record<string, unknown>,
): void {
  logger.log(event, data);
}
