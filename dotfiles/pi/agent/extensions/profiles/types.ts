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

export const ROUTE_NAMES = ["cheap", "auxiliar"] as const;

export type FixedRouteName = (typeof ROUTE_NAMES)[number];

/** Full persisted configuration — flat structure with required cheap/balanced/strong routes */
export type PersistedConfig = Record<FixedRouteName, ModelRoute>;

/** Result of loading and structurally validating configuration */
export type ConfigValidationResult =
  | { status: "valid"; config: PersistedConfig }
  | { status: "invalid"; config: PersistedConfig | null; errors: string[] }
  | { status: "missing" };
