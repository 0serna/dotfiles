import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

/** Thinking levels supported by Pi models */
export type ThinkingLevel = ModelThinkingLevel;

/** The full set of supported thinking levels, in increasing order. */
const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function isValidThinkingLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
}

/** A route configuration with model and thinking level */
export type ModelRoute = {
  model: string;
  thinkingLevel: ThinkingLevel;
};

/**
 * Persisted automatic route configuration.
 *
 * Each declared route token can be configured independently. Omitting a
 * token means the route is `[unset]`. Saving partial configuration is
 * allowed, and the runtime never requires every declared token to be
 * present.
 */
export type ModelRoutesConfig = Record<string, ModelRoute>;

/** Result of loading and structurally validating route configuration. */
export type RoutesValidationResult =
  | { status: "valid"; config: ModelRoutesConfig }
  | { status: "invalid"; config: ModelRoutesConfig | null; errors: string[] }
  | { status: "missing" };
