## Why

Route restoration currently reloads the globally persisted manual selection, so a model change in one concurrent Pi session can unexpectedly change another session when its routed work settles. Each session should restore its own manual selection while the persisted selection remains the startup default for future sessions.

## What Changes

- Define a session manual selection, containing the model and thinking level owned by one Pi session runtime.
- Initialize that selection from the globally persisted manual selection on every `session_start`.
- Continue publishing manual model and thinking-level changes to the global preferences file for future sessions.
- Restore routed work from the session's in-memory manual selection without reloading global preferences.
- Preserve the existing route activation, cancellation, settlement, failure, and session replacement behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-model-routing`: Route restoration changes from the latest globally persisted manual selection to the manual selection owned by the current session.

## Impact

- `dotfiles/pi/agent/extensions/model-routing/route-session.ts`
- Focused model-routing tests for concurrent-session isolation
- `openspec/specs/pi-model-routing/spec.md`
- `CONTEXT.md` terminology for manual selections and route restoration
- No API, dependency, route configuration, or persistence-format changes
