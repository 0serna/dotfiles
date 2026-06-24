## Context

The profiles extension now persists the user's manual model and thinking-level selection in `user-selection.json`. However, the extension can still hold a restored user selection in memory for the lifetime of one Pi process. If another Pi instance changes the user selection while the first instance has a route active, the first instance can restore a stale in-memory selection at `agent_end`.

The desired synchronization model is file-backed: every restore operation reads the latest persisted selection from disk at the moment restoration happens.

## Goals / Non-Goals

**Goals:**

- Remove long-lived in-memory user selection as the restoration source.
- Read `user-selection.json` fresh for `session_start` restoration and `agent_end` route restoration.
- Persist manual selection changes to `user-selection.json`.
- Ensure routed model activation/restoration and session-start restoration do not write routed models into `user-selection.json`.

**Non-Goals:**

- Change the `user-selection.json` persistence format.
- Prevent Pi from briefly starting with its own persisted default before extension restoration runs.
- Modify Pi upstream APIs or global settings directly.

## Decisions

- Use the user selection file as the single source of truth for restoration.
  - Rationale: This lets all Pi instances converge on the latest manual selection written by any instance.
  - Alternative considered: keep an in-memory snapshot and update it from file only at startup. Rejected because it can become stale during long-running routed commands.

- Resolve the persisted selection to an active model only at restoration time.
  - Rationale: Model availability can change between session start and route completion; resolving late reflects the current registry state.

- Keep in-memory state only for transient control flags such as route activity and ignored selection events.
  - Rationale: These flags are process-local behavior, not shared user preference state.

- Do not overwrite persisted selection when a persisted model cannot be restored.
  - Rationale: A route-contaminated Pi default or unavailable model should not replace the user's last manual selection.

## Risks / Trade-offs

- More file reads → Acceptable because reads happen on session start and route completion, not hot token paths.
- Manual selection write races → Last write wins; this matches the shared file as source-of-truth model.
- Restore can fail if the latest persisted model is unavailable → Leave the current Pi model unchanged and keep the persisted selection intact.
