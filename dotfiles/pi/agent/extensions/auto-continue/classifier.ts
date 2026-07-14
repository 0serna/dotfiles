export const TRANSIENT_FAILURE_SIGNALS = [
  "fetch failed",
  "WebSocket error",
  "Connection error",
  "Request timed out",
  "Streaming response failed",
  "Stream ended without finish_reason",
  "You can retry your request",
] as const;

export type TransientFailureSignal = (typeof TRANSIENT_FAILURE_SIGNALS)[number];

export function classifyTransientFailure(
  errorMessage?: string,
): TransientFailureSignal | undefined {
  if (!errorMessage) return undefined;
  const normalized = errorMessage.toLowerCase();
  return TRANSIENT_FAILURE_SIGNALS.find((signal) =>
    normalized.includes(signal.toLowerCase()),
  );
}
