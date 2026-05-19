## 1. Core: Parse per-turn data from branch entries

- [x] 1.1 Rewrite `formatCacheHit` to compute hit rate from the latest assistant message with usage data only, instead of accumulating all entries
- [x] 1.2 Add a helper `getPreviousHitRate` that finds the second-to-last assistant message with usage and returns its hit rate

## 2. Core: Regression detection and styling

- [x] 2.1 Replace `CACHE_HIT_WARNING_PERCENT` (absolute 80%) with `CACHE_HIT_REGRESSION_PP` (relative 25pp drop threshold)
- [x] 2.2 Update `styleCacheSegment` to accept both the current hit rate and the previous hit rate, and return warning color when a regression (drop ≥25pp) is detected
- [x] 2.3 Update `formatCacheHit` to return trend direction (`↑` / `↓` / empty) alongside the text and percent

## 3. Core: Wire up the status line

- [x] 3.1 Update `computeAndPublishStatus` to pass previous hit rate into the cache formatting pipeline
- [x] 3.2 Replace the "kv" label with "cache" in the displayed status text
- [x] 3.3 Ensure first-turn display shows no trend arrow and no regression color

## 4. Implementation: Cache unsupported detection

- [x] 4.1 Add `isCacheSupported(entries)` helper that checks if any assistant usage has `cacheRead > 0`
- [x] 4.2 Update `formatCacheHit` to return `cache —` when no entry has cache support
- [x] 4.3 Change no-data display from `cache ?%` to `cache 0%`

## 5. Implementation: Logging

- [x] 5.1 Add `import { log } from "./shared/logger.js"`
- [x] 5.2 Log `extension_loaded` with `{ cwd }` on `session_start`
- [x] 5.3 Log `regression_detected` with `{ previousHitRate, currentHitRate, drop }` when regression is detected
- [x] 5.4 Wrap `computeAndPublishStatus` in try/catch and log `status_error` with `{ error }` on failure

## 6. Cleanup

- [x] 6.1 Remove unused `CACHE_HIT_WARNING_PERCENT` constant
- [x] 6.2 Remove unused `ENTRY_TYPE` and `HISTORY_TYPE` references if any were carried over from supi-cache style (verify none exist in current code)
- [x] 6.3 Remove `styleCacheSegment` after its logic was absorbed inline

## 7. Verify

- [x] 7.1 Run `npm run check` to confirm linter, type checker, formatter, and Fallow complexity thresholds pass
