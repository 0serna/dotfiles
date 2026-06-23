import type { FixedRouteName } from "./types.ts";

export const ROUTE_TYPES = {
  "/skill:openspec-propose": "strong",
  "/skill:openspec-apply-change": "balanced",
  "/skill:openspec-archive-change": "cheap",
  "/skill:review": "strong",
  "/skill:commit": "cheap",
  "/compact": "balanced",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
