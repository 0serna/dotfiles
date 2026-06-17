import type { FixedRouteName } from "./types.ts";

export const ROUTE_TYPES = {
  "/skill:commit": "light",
  "/skill:openspec-archive-change": "light",
  "/skill:openspec-propose": "high",
  "/skill:simplify": "high",
  "/skill:review": "high",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
