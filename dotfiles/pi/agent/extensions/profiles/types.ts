import type { Api, Model } from "@earendil-works/pi-ai";

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

/** Snapshot of current state before a routed command */
export type RouteSnapshot = {
  model: Model<Api> | undefined;
  thinkingLevel: ThinkingLevel;
};

/** Full persisted configuration — flat structure with default and high routes */
export type PersistedConfig = {
  default: ModelRoute;
  high: ModelRoute;
};

/** Known fixed route names */
export const FIXED_ROUTE_NAMES = ["default", "high"] as const;

export type FixedRouteName = (typeof FIXED_ROUTE_NAMES)[number];

/** Result of loading and structurally validating configuration */
export type ConfigValidationResult =
  | { status: "valid"; config: PersistedConfig }
  | { status: "invalid"; config: PersistedConfig | null; errors: string[] }
  | { status: "missing" };
