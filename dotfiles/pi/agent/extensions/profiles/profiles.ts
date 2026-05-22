/**
 * Slash-command to route-type mapping.
 * Route types (default, light, heavy) are now fixed names, not defined here.
 */
export const ROUTE_TYPES = {
  "/opsx-propose": "heavy",
  "/opsx-apply": "light",
  "/opsx-archive": "light",
  "/review": "heavy",
  "/simplify": "light",
  "/commit": "light",
} as const satisfies Record<string, "default" | "light" | "heavy">;

/**
 * Route type used for compaction summarization.
 * Change this to "heavy" or "default" to use a different model tier.
 */
export const COMPACT_ROUTE = "light" as const satisfies
  | "default"
  | "light"
  | "heavy";

export type RouteName = keyof typeof ROUTE_TYPES;
