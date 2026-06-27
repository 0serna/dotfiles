import type { FixedRouteName } from "./types.ts";

export const ROUTE_TYPES = {
  "/skill:commit": "cheap",
  "/skill:openspec-archive-change": "cheap",
  "/compact": "balanced",
  "/skill:openspec-apply-change": "balanced",
  "/skill:simplify": "balanced",
  "/skill:review": "strong",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
