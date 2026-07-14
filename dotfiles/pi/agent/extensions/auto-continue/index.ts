import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  createExtensionLogger,
  type ExtensionLogger,
} from "../shared/logger.js";
import {
  AUTO_CONTINUE_REQUEST_EVENT,
  isAutoContinueRequest,
  type ContinuationReason,
} from "./contract.js";
import { RecoveryState } from "./recovery-state.js";

const QUIET_PERIOD_MS = 1_000;

type AssistantMessageEndEvent = {
  message?: {
    role?: string;
    stopReason?: string;
    errorMessage?: string;
    provider?: string;
    model?: string;
  };
};

type Origin = { provider?: string; model?: string };

const TRANSIENT_REASON = "transient-failure";

function cancelGuard(
  recovery: RecoveryState,
  logFn: (event: string, data?: Record<string, unknown>) => void,
  signal: string,
  cause: string,
): false {
  recovery.cancelRecovery();
  logFn("cancelled", { reason: TRANSIENT_REASON, signal, cause });
  return false;
}

export default function autoContinueExtension(pi: ExtensionAPI) {
  let active = false;
  let currentCtx: ExtensionContext | undefined;
  let logger: ExtensionLogger | undefined;
  let recovery = new RecoveryState();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingOrigin: Origin = {};
  let dispatching = false;

  function log(event: string, data?: Record<string, unknown>): void {
    logger?.log(event, data);
  }

  function cancelPending(cause: string): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
    recovery.cancelRecovery();
    log("cancelled", { reason: TRANSIENT_REASON, cause });
  }

  function dispatchContinuation(
    ctx: ExtensionContext,
    reason: ContinuationReason,
    data: Record<string, unknown>,
    onDispatched?: () => void,
  ): boolean {
    if (dispatching) {
      log("suppressed", { reason, cause: "request-coalesced" });
      return false;
    }

    dispatching = true;
    try {
      onDispatched?.();
      pi.sendUserMessage("continue", { deliverAs: "followUp" });
      log("sent", {
        reason,
        ...data,
        dispatchProvider: ctx.model?.provider,
        dispatchModel: ctx.model?.id,
      });
      return true;
    } finally {
      queueMicrotask(() => {
        dispatching = false;
      });
    }
  }

  function sendTransientContinuation(
    ctx: ExtensionContext,
    signal: string,
    origin: Origin,
  ): void {
    if (
      !active ||
      currentCtx !== ctx ||
      cancelGuard(recovery, log, signal, "inactive-runtime") ||
      !ctx.isIdle() ||
      cancelGuard(recovery, log, signal, "agent-busy") ||
      ctx.hasPendingMessages() ||
      cancelGuard(recovery, log, signal, "pending-messages")
    )
      return;

    dispatchContinuation(
      ctx,
      TRANSIENT_REASON,
      {
        signal,
        originProvider: origin.provider,
        originModel: origin.model,
      },
      () => recovery.markRecoveryContinuationDispatched(),
    );
  }

  pi.events.on(AUTO_CONTINUE_REQUEST_EVENT, (payload: unknown) => {
    if (!isAutoContinueRequest(payload)) {
      log("suppressed", {
        reason: "unsupported-request",
        cause: "invalid-payload",
      });
      return;
    }

    log("requested", {
      reason: payload.reason,
      originProvider: payload.origin?.provider,
      originModel: payload.origin?.model,
    });

    if (payload.reason !== "quota-rotation") return;
    const ctx = currentCtx;
    if (!active || !ctx) {
      log("suppressed", {
        reason: payload.reason,
        cause: "inactive-runtime",
      });
      return;
    }
    cancelPending("superseded-by-quota-rotation");
    recovery.startIndependentWork();
    dispatchContinuation(ctx, payload.reason, {
      originProvider: payload.origin?.provider,
      originModel: payload.origin?.model,
    });
  });

  pi.on("session_start", (_event, ctx) => {
    cancelPending("session-restarted");
    active = true;
    currentCtx = ctx;
    logger = createExtensionLogger(ctx, "auto-continue");
    recovery = new RecoveryState();
    pendingOrigin = {};
    dispatching = false;
  });

  pi.on("message_end", (event: AssistantMessageEndEvent, ctx) => {
    const message = event.message;
    if (!active || currentCtx !== ctx || message?.role !== "assistant") return;
    recovery.observeAssistantOutcome(message);
    pendingOrigin = {
      provider: message.provider ?? ctx.model?.provider,
      model: message.model ?? ctx.model?.id,
    };
    cancelPending("later-assistant-outcome");
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!active || currentCtx !== ctx) return;
    const decision = recovery.settle();
    if (decision.kind === "suppressed") {
      log("suppressed", {
        reason: TRANSIENT_REASON,
        signal: decision.signal,
        cause: decision.reason,
      });
      return;
    }
    if (decision.kind !== "recover") return;
    if (!ctx.isIdle()) {
      recovery.cancelRecovery();
      log("suppressed", {
        reason: TRANSIENT_REASON,
        signal: decision.signal,
        cause: "agent-busy-at-settlement",
      });
      return;
    }

    const origin = pendingOrigin;
    log("requested", {
      reason: TRANSIENT_REASON,
      signal: decision.signal,
      originProvider: origin.provider,
      originModel: origin.model,
    });
    log("scheduled", {
      reason: TRANSIENT_REASON,
      signal: decision.signal,
      delayMs: QUIET_PERIOD_MS,
    });
    timer = setTimeout(() => {
      timer = undefined;
      sendTransientContinuation(ctx, decision.signal, origin);
    }, QUIET_PERIOD_MS);
  });

  pi.on("input", (event) => {
    if (event.source !== "extension") {
      cancelPending("user-activity");
      recovery.startIndependentWork();
    }
    return { action: "continue" as const };
  });

  pi.on("agent_start", () => {
    cancelPending("agent-activity");
  });

  pi.on("session_shutdown", () => {
    cancelPending("session-shutdown");
    active = false;
    currentCtx = undefined;
    logger = undefined;
    recovery = new RecoveryState();
    pendingOrigin = {};
    dispatching = false;
  });
}
