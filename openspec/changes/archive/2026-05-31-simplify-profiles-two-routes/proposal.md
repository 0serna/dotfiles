## Why

The profiles extension uses a 3-tier routing model (`low`, `medium`, `high`) with multiple profiles (`default`, `fallback`). This complexity is unnecessary — real-world usage shows that `medium` and `high` routes often use the same model, and the `low` route is mainly used for compaction and simple commands that don't need special routing. Simplifying to 2 routes (`default`, `high`) with a single profile reduces cognitive overhead and aligns the system with actual usage patterns.

## What Changes

- **BREAKING**: Reduce route types from 3 (`low`, `medium`, `high`) to 2 (`default`, `high`)
- **BREAKING**: Consolidate to a single profile (remove `default`/`fallback` distinction)
- **BREAKING**: Flatten config structure — remove `activeProfile` and `profiles` wrapper
- **BREAKING**: Rename command from `/profiles` to `/profile`
- **BREAKING**: Remove footer status bar reporting
- **BREAKING**: Remove compaction-specific routing (`COMPACT_ROUTE`)
- Rename `DEFAULT_ROUTE` from `"medium"` to `"default"`
- Commands previously routing to `low` now route to `default`
- Rename `profiles.ts` to `routes.ts`

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `pi-model-profile-configuration`: Requirements change — single profile, 2 routes (default, high), flat config structure, no status bar, simplified command flow
- `pi-model-routing`: Requirements change — 2 routes instead of 3, no compaction-specific routing, commands previously routing to `low` now route to `default`

### Removed Capabilities

- `compact-low-routing`: Entire capability removed — compaction no longer triggers model switching

## Impact

- **Config file**: `~/.local/state/pi/profiles.json` — existing config will be invalid after migration; user must manually create new flat config
- **Extension code**: All files in `dotfiles/pi/agent/extensions/profiles/` affected
- **Types**: `ProfileName`, `FIXED_PROFILE_NAMES` removed; `PersistedConfig`, `Profile`, `FIXED_ROUTE_NAMES` simplified
- **UI**: `showProfileList` removed; command goes directly to route editor
- **Runtime**: Snapshot logic simplified (no compaction snapshots); status publishing removed
