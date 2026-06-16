## Why

The profiles extension currently fights Pi's native model persistence by forcing a configured default route and resetting manual model changes to medium thinking. Users should control their base model and per-model reasoning while keeping lightweight command routing available.

## What Changes

- **BREAKING** Remove the `default` route as the base model controller.
- Stop activating a default route on session start and stop restoring it after routed commands finish.
- Replace forced `medium` thinking on manual model set/cycle with persisted per-model thinking restoration.
- Track the last user-selected thinking level per model across Pi restarts.
- Add a configurable `high` route alongside `light`; it starts unset and is configured via `/profile`.

## Capabilities

### New Capabilities

- `per-model-thinking-memory`: Persist and restore the last thinking level used for each model.

### Modified Capabilities

- `pi-model-routing`: Remove default-route activation/restoration and support `light` plus `high` temporary routes.
- `pi-model-profile-configuration`: Change fixed route configuration from `default`/`light` to `light`/`high`.
- `auto-thinking-on-model-change`: Replace forced medium thinking with per-model thinking memory.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/profiles/*`.
- Affected state: profile route config in `$XDG_STATE_HOME/pi/profiles.json`; new per-model thinking state stored under Pi state.
- No new dependencies.
