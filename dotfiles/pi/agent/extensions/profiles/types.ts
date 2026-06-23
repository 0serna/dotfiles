/** Thinking levels supported by Pi models */
export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

/** A route configuration with model and thinking level */
export type ModelRoute = {
  model: string;
  thinkingLevel: ThinkingLevel;
};

export const ROUTE_NAMES = ["cheap", "balanced", "strong"] as const;

export type FixedRouteName = (typeof ROUTE_NAMES)[number];

/** Full persisted configuration — flat structure with required cheap/balanced/strong routes */
export type PersistedConfig = Record<FixedRouteName, ModelRoute>;

/** Result of loading and structurally validating configuration */
export type ConfigValidationResult =
  | { status: "valid"; config: PersistedConfig }
  | { status: "invalid"; config: PersistedConfig | null; errors: string[] }
  | { status: "missing" };
