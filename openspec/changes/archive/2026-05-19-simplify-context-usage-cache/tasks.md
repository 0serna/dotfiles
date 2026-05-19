## 1. Simplify cache formatting logic

- [x] 1.1 Remove removed functions and constants: `CACHE_HIT_REGRESSION_PP`, `computeTrend`, `isRegression`, `findLastTwoAssistantUsages`, `computeCacheRates`, `isCacheSupported`, `hasNoCacheData`
- [x] 1.2 Update `computeHitRate` to return `0` instead of `null` when denominator is 0
- [x] 1.3 Simplify `formatCacheHit` to a single path: if no latest assistant usage → early return `{ text: "cache 0%", percent: 0 }`, else compute hit rate and return `{ text: "cache N%", percent }` (remove `previousPercent` from return type)
- [x] 1.4 Remove `previousPercent` handling from `publishStatus`: both the variable extraction and the `isRegression` call

## 2. Apply threshold-based coloring

- [x] 2.1 Add constant `CACHE_HIT_WARNING_PERCENT = 80`
- [x] 2.2 Replace regression-based styling in `publishStatus`: if `cacheInfo.percent < CACHE_HIT_WARNING_PERCENT` → `mdHeading`, else → `dim`
- [x] 2.3 Remove `regression_detected` logging block from `publishStatus`

## 3. Add agent_end logging

- [x] 3.1 Subscribe to `agent_end` event calling `computeAndPublishStatus`
- [x] 3.2 In `publishStatus`, after computing cache info: if hit rate is unavailable, log `cache_unavailable` with appropriate reason (`no_assistant_messages`, `no_cache_reads`, `zero_denominator`); if hit rate is below threshold, log `cache_below_threshold` with `{ hitRate, threshold }`

## 4. Verify

- [x] 4.1 Run `npm run check` to verify linting, types, formatting
- [x] 4.2 Run `npm test` to verify existing tests still pass
