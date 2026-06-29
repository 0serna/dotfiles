import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { type DcpStatusMetrics, emptyDcpMetrics } from "./format.js";
import { pruneMessages } from "./prune.js";
import { computeAndPublishStatus } from "./status.js";

let logger: ExtensionLogger | undefined;
let contextSequence = 0;
let sessionId: string | undefined;
let lastDcp: DcpStatusMetrics = emptyDcpMetrics();

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "context");
    contextSequence = 0;
    lastDcp = emptyDcpMetrics();
    sessionId = ctx.sessionManager.getSessionId() ?? undefined;
    computeAndPublishStatus(ctx, logger, lastDcp);
  });

  pi.on("turn_end", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger, lastDcp, true);
  });

  pi.on("model_select", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger, lastDcp);
  });

  pi.on("agent_end", (_event, ctx) => {
    if (logger === undefined) return;
    computeAndPublishStatus(ctx, logger, lastDcp);
  });

  pi.on("context", (event) => {
    try {
      contextSequence += 1;
      const pruneResult = pruneMessages(event.messages, {
        logger,
        contextSequence,
        sessionId,
      });

      event.messages = pruneResult.messages;
      lastDcp = {
        contextSequence,
        stubbedCount: pruneResult.metrics.stubbedCount,
        estimatedSavedTokens: pruneResult.metrics.estimatedSavedTokens,
        reasonCounts: pruneResult.metrics.reasonCounts,
      };
    } catch (error) {
      logger?.log("context_prune_error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
