import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import { pruneMessages } from "./prune.js";

let logger: ExtensionLogger | undefined;
let contextSequence = 0;

type ExtensionOn = (
  event: string,
  handler: (
    event: unknown,
    ctx: Parameters<typeof createExtensionLogger>[0],
  ) => unknown,
) => void;

interface ContextEvent<T> {
  messages: readonly T[];
}

function isContextEvent(event: unknown): event is ContextEvent<unknown> {
  return (
    typeof event === "object" &&
    event !== null &&
    Array.isArray((event as { messages?: unknown }).messages)
  );
}

export default function dcp(pi: ExtensionAPI) {
  const on = pi.on as ExtensionOn;

  on("session_start", (_event, ctx) => {
    logger = createExtensionLogger(ctx, "dcp");
    contextSequence = 0;
  });

  on("context", (event) => {
    if (!isContextEvent(event)) return undefined;

    try {
      contextSequence += 1;
      return {
        messages: pruneMessages(event.messages, { logger, contextSequence }),
      };
    } catch {
      return { messages: event.messages };
    }
  });
}

export { pruneMessages };
