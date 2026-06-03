import type { FixedRouteName } from "./types.ts";

export const DEFAULT_ROUTE = "default" as const satisfies FixedRouteName;

export const ROUTE_TYPES = {
  "/commit": "light",
  "/skill:openspec-archive-change": "light",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
