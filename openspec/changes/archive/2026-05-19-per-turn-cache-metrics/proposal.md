## Why

The Pi footer shows a cumulative prompt-side cache hit percentage for the entire session (`ctx 12.3k · kv 80%`). This makes regressions invisible — a cache drop in one turn gets diluted by earlier history. Moving to per-turn cache metrics with trend direction and automatic regression flagging gives immediate, actionable feedback on cache health.

## What Changes

- Cache hit percentage changes from session-cumulative to **latest-turn-only** with trend arrow (↑/↓ vs preceding turn)
- "kv" label replaced with "cache"
- When hit rate drops ≥25 percentage points between adjacent turns, the cache segment changes color (warning state)
- Old absolute threshold (`CACHE_HIT_WARNING_PERCENT = 80`) removed — replaced by relative regression detection
- No notification toasts; only color change on the footer status

## Capabilities

### New Capabilities

_(None — the changes are modifications to the existing cache percentage display contract.)_

### Modified Capabilities

- `pi-footer-token-metrics`: Cache percentage requirement changes from cumulative to per-turn with trend arrow and regression color flagging

## Impact

- **Modified file**: `dotfiles/pi/agent/extensions/context-usage.ts`
- **Dependencies**: Pi extension API (`ctx.sessionManager.getBranch()`, `ctx.ui.theme.fg()`, `ctx.ui.setStatus()`)
- **No new dependencies, no package.json changes**
