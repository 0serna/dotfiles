## 1. Unified manual preference state

- [x] 1.1 Define the `ManualPreferences` record with separate current `selection` and per-model `thinkingMemory` fields, keeping `profiles.json` outside the record.
- [x] 1.2 Replace the two manual-preference persistence modules with one deep persistence module for `manual-preferences.json`.
- [x] 1.3 Implement structural validation, FIFO writes, read-after-write ordering, and atomic complete-record replacement for the unified file.
- [x] 1.4 Implement snapshot updates that change the current manual selection and matching per-model memory together.
- [x] 1.5 Manually merge the existing `user-selection.json` and `thinking-memory.json` into `manual-preferences.json`, giving the current selection precedence for its model, verify the result, and remove the two old files.

## 2. Selection transition coordinator

- [x] 2.1 Define the internal pure transition reducer state, normalized facts, and explicit effects for model selection, thinking-level selection, restoration, and suppression.
- [x] 2.2 Encode the clamp rule: a thinking-level event after the active model identity changes and before the target model selection is not a manual preference.
- [x] 2.3 Integrate the reducer into `route-session.ts` while preserving the existing Pi hook registration and public route-session surface.
- [x] 2.4 Route manual model selection through the coordinator so remembered thinking is applied after the model transition and the unified preference snapshot is persisted.
- [x] 2.5 Route manual thinking-level selection through the coordinator so the current selection and per-model memory are persisted as one snapshot.
- [x] 2.6 Preserve route activation, route restoration, session-start restoration, unavailable-model behavior, and shutdown semantics without persisting automatic route state.

## 3. Verification

- [x] 3.1 Add reducer tests for manual selection, automatic clamp ordering, repeated model switches, and non-manual selection sources.
- [x] 3.2 Add lifecycle tests for session start, route activation/restoration, chained routes, and current-model tracking.
- [x] 3.3 Add persistence tests for unified snapshots, serialized writes, read-after-write behavior, atomic replacement, malformed state, and write failures.
- [x] 3.4 Add an integration-shaped regression test matching the observed Pi sequence: model change, automatic `max` clamp, then restoration of remembered `high`.
- [x] 3.5 Run `npm run check` and `openspec validate --all --no-interactive`.
