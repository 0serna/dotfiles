export const AUTO_CONTINUE_REQUEST_EVENT = "auto-continue:request";

export type ContinuationReason = "quota-rotation" | "transient-failure";

export interface AutoContinueRequest {
  reason: ContinuationReason;
  origin?: {
    provider?: string;
    model?: string;
  };
}

export function isAutoContinueRequest(
  value: unknown,
): value is AutoContinueRequest {
  if (!value || typeof value !== "object") return false;
  const reason = (value as { reason?: unknown }).reason;
  return reason === "quota-rotation" || reason === "transient-failure";
}
