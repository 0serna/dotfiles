## 1. Persistence

- [x] 1.1 Add profiles-owned persisted user selection state for model id and thinking level.
- [x] 1.2 Load persisted user selection during extension startup/session initialization.
- [x] 1.3 Persist user selection updates after manual model or thinking-level changes.

## 2. Restoration Flow

- [x] 2.1 Restore persisted user selection on `session_start` when the model is available and activates successfully.
- [x] 2.2 Keep Pi's current model unchanged when the persisted user model is unavailable or cannot activate.
- [x] 2.3 Use the persisted user selection as the source of truth for `agent_end` route restoration.
- [x] 2.4 Ensure route activation, route restoration, and session-start restoration do not overwrite persisted manual selection.

## 3. Tests and Validation

- [x] 3.1 Replace the temporary failing persistence-window test with a session-start restoration regression test.
- [x] 3.2 Add tests for persisting manual model and thinking-level selections.
- [x] 3.3 Add tests for unavailable persisted user model behavior.
- [x] 3.4 Run the profiles test suite.
- [x] 3.5 Run the repository check suite.
