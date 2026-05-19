## Why

The cache hit rate display in the context-usage extension uses trend indicators (↑↓), regression detection (25pp drop threshold), and a separate `cache —` state for models without cache support. This logic is over-engineered for its value — it tracks two data points, computes deltas, and flags regressions, but the result is rarely actionable. A simpler fixed threshold (80%) is more intuitive, easier to reason about, and consistent with how the codex-quota extension handles warnings. Additionally, the extension lacks structured logging, making it impossible to diagnose cache performance historically.

## What Changes

- **Remove** trend indicators (`computeTrend`, ↑↓ display)
- **Remove** regression detection (`CACHE_HIT_REGRESSION_PP`, `isRegression`, `regression_detected` log event)
- **Remove** `cache —` state for unsupported models — all non-computable cases show `cache 0%`
- **Set fixed threshold at 80%**: cache hit rate below 80% → `mdHeading` color, at/above 80% → `dim`
- **Simplify `computeHitRate`**: return `0` instead of `null` when denominator is 0
- **Collapse branching logic**: unify `isCacheSupported` / `hasNoCacheData` / `computeCacheRates` into a single path
- **Simplify `formatCacheHit` return type**: `{ text, percent }` only (remove `previousPercent`)
- **Add logging**: `cache_below_threshold` and `cache_unavailable` at `agent_end`
- **Subscribe to `agent_end`** event for logging (new event subscription)

## Capabilities

### New Capabilities

- `cache-hit-monitoring`: How the extension computes, formats, colors, and logs cache hit rate information

### Modified Capabilities

_None — no existing specs cover this extension behavior._

## Impact

Only file affected: `dotfiles/pi/agent/extensions/context-usage.ts`. No API changes, no dependency changes, no public interface changes. The status bar output format changes (no more ↑↓, no more `cache —`), and the color logic changes from regression-based to threshold-based.
