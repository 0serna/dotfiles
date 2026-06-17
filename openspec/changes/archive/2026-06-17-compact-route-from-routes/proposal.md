## Why

The `compact` route is the only profile route that cannot be declared in `routes.ts` alongside the other slash-command route mappings. Instead it is configured as a dedicated `ModelRoute` (model + thinking level) through the `/profile` TUI editor and persisted independently in `profiles.json`. This splits a single concept (which route `/compact` uses) across two places: the token→route table in `routes.ts` and the persisted `compact` entry. Consolidating the `/compact` mapping into `routes.ts` keeps all slash-command route declarations in one place and removes a redundant configuration surface.

## What Changes

- Add a `"/compact"` entry to `ROUTE_TYPES` in `routes.ts`, mapped to an existing fixed route name (`high`).
- `session_before_compact` now resolves the compaction route via an optional `ROUTE_TYPES["/compact"]` mapping against the persisted `light`/`high` configuration instead of a dedicated `config.compact` entry.
- If `ROUTE_TYPES` does not contain `"/compact"`, the extension does not provide a custom compaction result and Pi uses its default compaction behavior.
- **BREAKING**: Remove the optional `compact` route from `PersistedConfig` (the `compact?: ModelRoute` field), so persisted configuration is a flat object with only `light` and `high` keys.
- Remove the `compact` route row, its "unset optional" handling, and the compact-unsusable save rejection from the `/profile` route editor (`ui.ts`, `command.ts`).
- Remove `resolveCompactRoute` and the `compactRoute` runtime state; collapse `AllRouteName` into `FixedRouteName`.
- Drop the `compact`-specific structural-validation comment and the now-dead compact scenarios from the test suite.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pi-compact-profile-route`: The compaction model and thinking level are no longer selected from a dedicated optional `compact` route. `/compact` is mapped in `routes.ts` to an existing named route (`high`), and compaction uses that named route's persisted model and thinking level. Removing the `/compact` mapping disables custom compact routing and restores Pi default compaction.
- `pi-model-profile-configuration`: The persisted configuration no longer contains an optional `compact` route. The `/profile` editor no longer shows a `compact` row or supports unsetting it. The configuration is a flat object with required `light` and `high` routes only.

## Impact

- `dotfiles/pi/agent/extensions/profiles/routes.ts`: new `"/compact"` mapping.
- `dotfiles/pi/agent/extensions/profiles/index.ts`: `session_before_compact` rewritten to use `ROUTE_TYPES["/compact"]` and `config[routeType]`; compact-route runtime lookup removed.
- `dotfiles/pi/agent/extensions/profiles/routing.ts`: `resolveCompactRoute` deleted.
- `dotfiles/pi/agent/extensions/profiles/runtime.ts`: `compactRoute` state and `getCompactRoute` removed.
- `dotfiles/pi/agent/extensions/profiles/types.ts`: `compact?: ModelRoute` removed from `PersistedConfig`; `AllRouteName` removed (or collapsed to `FixedRouteName`).
- `dotfiles/pi/agent/extensions/profiles/ui.ts`: `compact` removed from `ALL_ROUTES`, route initialization, and the "unset optional" keybinding branch.
- `dotfiles/pi/agent/extensions/profiles/command.ts`: compact-unsusable save-rejection block removed.
- `dotfiles/pi/agent/extensions/profiles/state.ts`: optional-compact structural-validation comment removed.
- `dotfiles/pi/agent/extensions/profiles/profiles.test.ts`: compact-route compaction tests, editor compact tests, and "preserves/malformed compact" tests removed; `validConfig` helper simplified.
- Persisted `profiles.json` files with a `compact` key are no longer read for compaction; the key becomes ignored dead data (no migration, no error).
- No external API or dependency changes.
