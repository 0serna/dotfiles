## 1. Configuration Model

- [x] 1.1 Add optional `compact?: ModelRoute` to the persisted profile config type
- [x] 1.2 Keep structural validation strict for required `light` and `high` routes only
- [x] 1.3 Add compact-route usability validation that does not invalidate required routing

## 2. Profile Editor

- [x] 2.1 Show `compact` as an optional route row in `/profile`
- [x] 2.2 Allow editing `compact` with the existing model and thinking-level picker flow
- [x] 2.3 Allow unsetting `compact` and saving without a compact route
- [x] 2.4 Keep save blocking limited to incomplete required `light` and `high` routes

## 3. Compaction Routing

- [x] 3.1 Add a `session_before_compact` handler in the profiles extension
- [x] 3.2 Resolve the usable compact route model and auth without changing the active Pi model
- [x] 3.3 Generate custom compaction via Pi's exported `compact(...)` helper with configured thinking level
- [x] 3.4 Fall back silently to default compaction when compact is absent or invalid
- [x] 3.5 Warn and fall back to default compaction when configured compact runtime use fails

## 4. Verification

- [x] 4.1 Add or update tests for optional compact config validation and persistence
- [x] 4.2 Add or update tests for `/profile` optional compact editing and unsetting
- [x] 4.3 Add or update tests for compact-route compaction and fallback behavior
- [x] 4.4 Run the repository check suite
