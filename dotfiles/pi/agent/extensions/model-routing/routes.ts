/**
 * The ordered catalog of route tokens owned by the extension.
 *
 * Every token here is editable through `/model-routes` and is routed
 * directly: the configuration for `/skill:commit` is whatever the user
 * stored under the `"/skill:commit"` key.
 *
 * `/compact` is part of the same catalog. It is invoked through
 * `session_before_compact` instead of an `input` event, but it shares
 * the same `ModelRoute` shape, the same editor row, and the same
 * activation logic.
 */
export const ROUTE_TOKENS = [
  "/compact",
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
