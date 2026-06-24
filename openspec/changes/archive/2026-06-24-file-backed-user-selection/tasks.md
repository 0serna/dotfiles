## 1. Restoration Source of Truth

- [x] 1.1 Remove long-lived in-memory user selection as the source for route restoration.
- [x] 1.2 Add a shared restore helper that reads `user-selection.json` fresh before restoring.
- [x] 1.3 Use the shared restore helper from `session_start`.
- [x] 1.4 Use the shared restore helper from `agent_end` route restoration.

## 2. Persistence Semantics

- [x] 2.1 Keep persisting manual model selections to `user-selection.json`.
- [x] 2.2 Keep persisting manual thinking-level selections to `user-selection.json`.
- [x] 2.3 Ensure route activation, route restoration, and session-start restoration do not persist routed models as user selection.
- [x] 2.4 Ensure unavailable or failed persisted selection restoration does not overwrite `user-selection.json`.

## 3. Tests and Validation

- [x] 3.1 Add a regression test where another instance updates `user-selection.json` while a route is active and `agent_end` restores the latest file-backed selection.
- [x] 3.2 Update existing session-start restoration tests to assert file-backed behavior.
- [x] 3.3 Add or update tests proving no persisted selection leaves route completion unchanged.
- [x] 3.4 Run the profiles test suite.
- [x] 3.5 Run the repository check suite.
