## Context

The Pi footer extension at `dotfiles/pi/agent/extensions/context-usage.ts` displays a status line like:

```
ctx 12.3k · kv 80%
```

The cache percentage (`kv 80%`) is computed by summing all `cacheRead` and `input` tokens across every assistant message in the session's branch history. This cumulative average smooths out per-turn variation and makes sudden drops invisible — a regression in one turn is diluted by the long tail of high-hit-rate history.

Supi-cache (external package `@mrclrchtr/supi-cache`) demonstrates a per-turn approach that detects regressions and shows trend direction. This design adopts that approach without installing supi-cache or adding its cross-session forensics.

## Goals / Non-Goals

**Goals:**

- Compute cache hit rate from the latest assistant message only (per-turn, not cumulative)
- Show trend arrow (↑/↓) vs the preceding turn
- Visually flag regression (≥25pp drop between adjacent turns) via theme color change on the cache segment
- Replace the "kv" label with "cache"
- Detect and display when the model does not support cache (show `cache —`)
- Log significant events (extension loaded, regression detected, errors) for diagnostics
- Preserve all other behaviors (context-usage display, warning threshold for context tokens)

**Non-Goals:**

- Cross-session forensics or history commands (supi-cache's `/supi-cache-history`, `/supi-cache-forensics`)
- Notification toasts for regressions
- Cause diagnosis (compaction, model change, prompt change detection)
- Persistence of turn records beyond session lifetime
- Configurable threshold (constant is sufficient for now)

## Decisions

### Decision 1: Derive per-turn data from branch entries (no module-level state)

**Chosen**: Iterate `ctx.sessionManager.getBranch()` to find the last two assistant messages with usage, compute each independently.

**Alternatives considered**:

- **Module-level variable** — simpler computationally but risks drift if the extension reloads mid-session; the branch is the authoritative source of truth.
- **Custom persisted entries** (supi-cache approach) — more robust but adds complexity; unnecessary since we don't need cross-session persistence beyond the branch's lifetime.
- **Accumulator that resets each turn** — could miss entries if the turn_end event fires at a different point in the message lifecycle.

**Rationale**: The branch already contains every message in the session ordered chronologically. Computing from it is stateless, self-correcting on reload, and requires zero new infrastructure.

### Decision 2: Regression threshold of 25 percentage points

**Chosen**: A drop of ≥25pp between the previous turn's hit rate and the current turn's hit rate triggers the warning color.

**Rationale**: Mirrors supi-cache's proven default of 25pp. Smaller drops (e.g., 85%→70%) can happen with normal prompt variation; 25pp represents a meaningful loss of cache efficiency.

### Decision 3: Remove old absolute threshold (CACHE_HIT_WARNING_PERCENT = 80)

**Chosen**: The old threshold warned when hit rate was below 80% regardless of context. Replace entirely with regression-based detection.

**Rationale**: A persistent low hit rate (e.g., 45% on a cold-start session) is not necessarily a problem worth flagging — the user already sees the number. Regressions are actionable: something changed between turns that broke cache locality.

### Decision 4: Warning via color change only, no notification toast

**Chosen**: Change the cache segment to `ctx.ui.theme.fg("mdHeading", ...)` when regression detected, revert to `ctx.ui.theme.fg("dim", ...)` otherwise.

**Rationale**: Aligns with the existing visual language (mdHeading already used for context-warning and old cache-warning states). A toast is disruptive; the footer status is always visible and sufficient.

### Decision 5: Label text "cache" instead of "kv"

**Chosen**: The displayed segment reads `cache 87%↑` instead of `kv 87%↑`.

**Rationale**: "kv" is an implementation detail (KV cache). "cache" is more user-friendly and matches supi-cache's convention.

### Decision 6: Log significant events, not every turn

**Chosen**: Log only three event types: `extension_loaded` (on session start), `regression_detected` (when ≥25pp drop occurs), and `status_error` (when publishing status fails).

**Rationale**: Logging every turn would be noisy. The selected events cover availability, regressions, and failures — the three categories useful for diagnostics.

**Data**: Each log entry includes `{ cwd }` (extension_loaded), `{ previousHitRate, currentHitRate, drop }` (regression_detected), or `{ error }` (status_error). No session ID is included, consistent with other extensions in the project.

### Decision 7: Detect cache support statelessly from branch entries

**Chosen**: Check if any assistant message in the branch has `cacheRead > 0`. If none do, show `cache —`.

**Alternatives considered**:

- **Cross-turn state flag** (supi-cache approach) — more accurate but requires module-level state; the branch is sufficient.
- **Assume always supported** — would show `cache 0%` even for models that never support cache, causing confusion.

**Rationale**: A model that supports cache will eventually have a turn with `cacheRead > 0`. Until then, showing `cache —` avoids falsely implying cache is available. The approach is stateless and self-correcting.

## Risks / Trade-offs

| Risk                                                                                                                        | Mitigation                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Empty branch** — on first turn_end there may be only one assistant message, so no previous turn for comparison            | Show hit rate without arrow; no regression detection possible                                 |
| **Provider reports no usage** — some providers (e.g., non-Anthropic) may not include `usage` data on assistant messages     | Show `cache 0%` without arrow; trend and regression not possible without data                 |
| **Denominator zero** — `cacheRead + input === 0` on a turn                                                                  | Return `null` hit rate; show `cache 0%` without arrow                                         |
| **Cache unsupported misdetection** — a cache-supporting model with all `cacheRead === 0` in the branch would show `cache —` | Rare in practice; first cache hit immediately switches to `cache XX%`                         |
| **Session compaction** — the branch may lose older entries after compaction                                                 | Only the last two entries matter, so compaction is harmless                                   |
| **Error in status publishing** — unexpected errors in `computeAndPublishStatus`                                             | Wrapped in try/catch; logged as `status_error`; error does not propagate to break the session |
| **Threshold sensitivity** — 25pp may be too high or low for specific workflows                                              | Hardcoded for now; easy to adjust later if feedback warrants                                  |
