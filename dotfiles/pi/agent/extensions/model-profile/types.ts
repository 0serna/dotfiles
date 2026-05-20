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

/** A model profile with three fixed routes */
export type ModelProfile = {
  default: ModelRoute;
  light: ModelRoute;
  heavy: ModelRoute;
};

/** Snapshot of current state before a routed command */
export type RouteSnapshot = {
  model: Model<Api> | undefined;
  thinkingLevel: ThinkingLevel;
};

/** Full persisted profile configuration */
export type PersistedConfig = {
  activeProfile: string;
  profiles: Record<string, ModelProfile>;
};

/** Known fixed profile names */
export const FIXED_PROFILE_NAMES = ["mixed", "opencode"] as const;

export type ProfileName = (typeof FIXED_PROFILE_NAMES)[number];

/** Known fixed route names within each profile */
export const FIXED_ROUTE_NAMES = ["default", "light", "heavy"] as const;

export type FixedRouteName = (typeof FIXED_ROUTE_NAMES)[number];

/** Result of loading and structurally validating profile configuration */
export type ConfigValidationResult =
  | { status: "valid"; config: PersistedConfig }
  | { status: "invalid"; config: PersistedConfig | null; errors: string[] }
  | { status: "missing" };
