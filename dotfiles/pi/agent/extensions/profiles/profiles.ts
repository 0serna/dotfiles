import type { FixedRouteName } from "./types.ts";

/**
 * Slash-command to route-type mapping.
 * Route types (low, medium, high) are fixed names, not defined here.
 */
export const ROUTE_TYPES = {
  "/grill-me": "medium",
  "/simplify": "medium",
  "/skill:openspec-propose": "high",
  "/review": "high",
} as const satisfies Record<string, FixedRouteName>;

/**
 * Route type used for compaction summarization.
 * Change this to "high" or "low" to use a different model tier.
 */
export const COMPACT_ROUTE = "low" as const satisfies FixedRouteName;

export type RouteName = keyof typeof ROUTE_TYPES;
