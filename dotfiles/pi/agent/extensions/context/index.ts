import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { computeAndPublishStatus } from "./status.js";

let logger: ExtensionLogger | undefined;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "context");
    computeAndPublishStatus(ctx, logger);
  });

  pi.on("turn_end", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger, true);
  });

  pi.on("model_select", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger);
  });

  pi.on("agent_end", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger);
  });
}
