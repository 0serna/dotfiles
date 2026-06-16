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

/** Full persisted configuration — flat structure with required light/high and optional compact routes */
export type PersistedConfig = {
  light: ModelRoute;
  high: ModelRoute;
  compact?: ModelRoute;
};

export type FixedRouteName = "light" | "high";

/** All route names including the optional compact route */
export type AllRouteName = FixedRouteName | "compact";

/** Result of loading and structurally validating configuration */
export type ConfigValidationResult =
  | { status: "valid"; config: PersistedConfig }
  | { status: "invalid"; config: PersistedConfig | null; errors: string[] }
  | { status: "missing" };
