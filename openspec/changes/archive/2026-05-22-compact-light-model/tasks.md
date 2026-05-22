## 1. Runtime state for compact snapshot

- [x] 1.1 Add `compactSnapshot` variable to `ProfilesRuntime` in `runtime.ts`
- [x] 1.2 Add `markCompactSnapshot(snapshot)`, `hasCompactSnapshot()`, `consumeCompactSnapshot()` methods to the runtime return object

## 2. Compaction event handlers

- [x] 2.1 Add `session_before_compact` handler in `index.ts` that checks `configEnabled()`, skips if `hasRoutedSnapshot()`, saves snapshot of current model/thinking, and calls `activateRoute` for the light route
- [x] 2.2 Add `session_compact` handler in `index.ts` that consumes the compact snapshot and restores the saved model and thinking level

## 3. Verification

- [x] 3.1 Run `npm run check` and ensure all quality gates pass
