import type { FixedRouteName } from "./types.ts";

export const DEFAULT_ROUTE = "medium" as const satisfies FixedRouteName;

export const COMPACT_ROUTE = "low" as const satisfies FixedRouteName;

export const ROUTE_TYPES = {
  "/commit": "low",
  "/simplify": "low",
  "/skill:openspec-archive-change": "low",
  "/skill:openspec-propose": "high",
  "/review": "high",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
