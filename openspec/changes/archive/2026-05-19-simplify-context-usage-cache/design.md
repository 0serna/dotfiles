## Context

The `context-usage` extension (`dotfiles/pi/agent/extensions/context-usage.ts`) displays context window usage and cache hit rate in the pi status bar. The cache section currently uses trend indicators (↑↓), regression detection against the previous turn (25pp drop threshold), and a separate `cache —` state for models without cache support. The extension only logs errors — no cache or context events are recorded for historical analysis.

The existing split into `isCacheSupported`, `hasNoCacheData`, and `computeCacheRates` creates three formatting paths that produce different outputs (`cache 0%`, `cache —`, `cache N%[↑↓]`). The trend/regression logic requires tracking two data points per session but the result (an arrow + occasional red color) is low-signal.

## Goals / Non-Goals

**Goals:**

- Replace regression/trend logic with a fixed 80% threshold for cache display coloring
- Collapse the three formatting paths into one: one input, two outputs (`cache 0%` or `cache N%`)
- Add structured logging of cache events (`cache_below_threshold`, `cache_unavailable`) at `agent_end`
- Keep the extension under 200 lines of TypeScript (currently ~200 before change)

**Non-Goals:**

- No changes to the context usage display (`ctx Nk`) or its over-limit coloring
- No changes to the footer extension or status bar layout
- No configurable threshold (remains hardcoded)
- No session-level aggregation of cache stats beyond the latest turn

## Decisions

### 1. Fixed threshold at 80% (hardcoded)

**Decision**: Use a `CACHE_HIT_WARNING_PERCENT = 80` constant; below this → `mdHeading`, at/above → `dim`.

**Rationale**: Consistent with `codex-quota.ts`'s pattern of hardcoded `warnThreshold` per segment. 80% is a sensible minimum: below 80% means more than 1 in 5 tokens missed cache, which is worth surfacing. A configurable threshold adds complexity without evidence it's needed.

**Alternatives considered**: Configurable via settings (rejected — no user demand, adds complexity). Dynamic threshold based on model (rejected — no data to support per-model tuning).

### 2. Single formatting path (collapse `isCacheSupported` / `hasNoCacheData`)

**Decision**: Unify all non-computable cases into a single early return: `{ text: "cache 0%", percent: 0 }`. Remove `isCacheSupported`, `hasNoCacheData`, `computeCacheRates`.

**Rationale**: All three cases (no assistant messages, no cacheRead data, zero denominator) produce the same user-facing behavior: `cache 0%` with `mdHeading` color (since 0 < 80). Distinguishing them is unnecessary for the UI and can be handled by `cache_unavailable` logging with different reasons.

### 3. `computeHitRate` returns `0` instead of `null`

**Decision**: When `input + cacheRead === 0`, return `0` instead of `null`.

**Rationale**: A hit rate of 0% is semantically correct when no tokens were exchanged. Returning `null` forces null-handling in every consumer (`formatPercent`, color logic). Returning `0` simplifies the entire pipeline.

**Alternatives considered**: Keep `null` and handle in `formatPercent` (rejected — pushes complexity upstream without benefit).

### 4. Logging at `agent_end`

**Decision**: Subscribe to the `agent_end` event. Log `cache_below_threshold` when hit rate < 80%, log `cache_unavailable` when hit rate cannot be computed (with reason). Do not log on every `turn_end` or `session_start`.

**Rationale**: `agent_end` fires once per user prompt (after all LLM turns), giving a stable snapshot. Logging every `turn_end` would be noisy (multiple turns per prompt with the same data). `session_start` happens before any assistant interaction so there's no cache data yet.

**Alternatives considered**: Log every `turn_end` (rejected — noisy). Log only on `session_start` (rejected — no cache data yet). Don't log at all (rejected — defeats purpose of monitoring).

### 5. Remove `previousPercent` tracking

**Decision**: `formatCacheHit` returns `{ text, percent }` only; remove `findLastTwoAssistantUsages` → replace with `findLatestAssistantUsage`.

**Rationale**: No downstream consumer needs the previous turn's hit rate since regression detection is removed.

## Risks / Trade-offs

| Risk                                                                                                           | Mitigation                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `agent_end` event may not fire in all session termination paths                                                | Test manually; if gaps exist, also fire on `turn_end` as fallback                                                          |
| No regression logging means gradual performance degradation is invisible                                       | `cache_below_threshold` fires every `agent_end` while below 80%, so duration of degraded performance is observable in logs |
| Removing `cache —` removes ability to distinguish "model doesn't support cache" from "cache is cold" in the UI | `cache_unavailable` logging with reason preserves this distinction in logs; UI shows 0% in both cases which is honest      |
