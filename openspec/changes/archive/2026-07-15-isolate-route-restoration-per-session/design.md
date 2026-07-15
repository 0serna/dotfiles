## Context

The extension stores manual model and thinking-level preferences in a user-scoped file shared by all Pi processes. Each model-routing session already holds a `preferences` snapshot in memory and updates that snapshot whenever the user makes a manual selection. However, route settlement reloads the shared file before restoration, allowing a concurrent session's later write to replace the current session's intended restoration target.

Pi creates a fresh extension runtime and emits `session_start` for startup, reload, new, resume, and fork flows. Those boundaries intentionally continue to initialize state from the shared file.

## Goals / Non-Goals

**Goals:**

- Isolate route restoration to the model and thinking level selected in the current session.
- Preserve the shared file as the startup default for future session runtimes.
- Preserve current manual-selection persistence, route cancellation, settlement, and restoration-failure behavior.
- Make the distinction between session-owned and globally persisted selections explicit in tests, specifications, and domain language.

**Non-Goals:**

- Coordinating concurrent writes across Pi processes.
- Changing the preferences file path, format, or best-effort persistence policy.
- Preserving in-memory selection across a session replacement or extension reload.
- Changing route configuration or `/compact` behavior.

## Decisions

### Treat the existing in-memory preferences snapshot as session-owned state

`route-session.ts` already loads `preferences` during `session_start` and updates it synchronously before scheduling each persistence write. Route restoration will use this snapshot directly instead of introducing another model-selection store.

Alternative considered: add a separate `sessionSelection` field. This would duplicate `preferences.selection` and create synchronization risks without adding a distinct lifecycle.

### Read shared preferences only at session initialization

Every `session_start` continues to load the global preferences file. This includes startup, reload, new, resume, and fork because Pi creates a fresh extension runtime at those boundaries. No read occurs when a route settles.

Alternative considered: preserve process-local state across session replacement. This conflicts with Pi's extension lifecycle and with the requirement that every new session initialize from the latest global selection.

### Keep writes global and restoration local

A manual model or thinking-level change first updates the session snapshot, then schedules the same global persistence write used today. Future sessions therefore observe the latest successfully persisted selection, while active sessions retain their own restoration target.

Alternative considered: stop writing global preferences after startup. This would isolate sessions but break persistence for future sessions.

### Cover the behavior at the lifecycle boundary

Focused extension tests will simulate an external preferences-file change after route activation and assert that settlement restores the original session selection and thinking level. Existing tests continue to cover session-start loading, manual updates, cancellation, idle settlement, and restoration failures.

## Risks / Trade-offs

- [A session does not observe later selections from another session until its next `session_start`] → This is intentional isolation and will be documented as session ownership.
- [Concurrent processes can still race while writing the shared file] → Keep this explicitly out of scope; the change does not alter existing persistence mechanics.
- [Terminology can imply that restoration reads durable state] → Define separate terms for session manual selection and latest persisted manual selection, and update route restoration language.

## Migration Plan

No data migration is required because the preferences schema is unchanged. Deploy the extension change normally; rollback restores the previous cross-session restoration behavior without changing persisted files.

## Open Questions

None.
