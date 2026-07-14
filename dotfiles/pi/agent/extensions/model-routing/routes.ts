export const ROUTE_TOKENS = [
  "/compact",
  "/skill:openspec-propose",
  "/skill:openspec-apply-change",
  "/skill:openspec-archive-change",
  "/skill:code-review",
  "/skill:simplify",
  "/skill:commit",
] as const;

export type RouteName = (typeof ROUTE_TOKENS)[number];

export function isRouteName(token: string): token is RouteName {
  return (ROUTE_TOKENS as readonly string[]).includes(token);
}
