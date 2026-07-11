import type { FixedRouteName } from "./types.ts";

export const ROUTE_TYPES = {
  "/compact": "cheap",
  "/skill:commit": "cheap",
  "/skill:openspec-archive-change": "cheap",
  "/skill:openspec-apply-change": "auxiliar",
  "/skill:simplify": "auxiliar",
  "/skill:code-review": "auxiliar",
} as const satisfies Record<string, FixedRouteName>;

export type RouteName = keyof typeof ROUTE_TYPES;
