## Why

The profiles extension routes commands through shared `cheap` and `auxiliar` categories, so unrelated skills cannot be configured independently and the `/profile` UI exposes implementation-oriented categories instead of the actual routed commands. Each route should own its model configuration and appear directly in the editor.

## What Changes

- Replace shared named-route mappings with independent model and thinking-level configuration keyed by each route token, such as `/skill:commit`.
- List every declared route directly in the editor and allow each route to be configured or unset independently.
- Isolate route validity so an absent or unusable route does not disable other routes.
- Preserve unavailable routes when only credentials are temporarily missing, while sanitizing structurally invalid, unknown-model, and unsupported-thinking entries.
- Keep `/compact` as a special route whose configuration applies to manual and automatic compaction.
- **BREAKING** Rename the extension directory from `profiles` to `model-routing`, the editor command from `/profile` to `/model-routes`, and persisted route state from `profiles.json` to `model-routes.json`; no runtime legacy compatibility or migration is provided.
- Manually expand the existing local `cheap` and `auxiliar` configuration into per-token entries, verify it, and remove the old state file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-model-routing`: Route commands directly to independent per-token configuration, isolate route failures, and rename the interactive command.
- `pi-model-profile-configuration`: Replace required shared profile routes with a partial per-token route catalog and define editing, unsetting, sanitization, and persistence behavior.
- `pi-compact-profile-route`: Resolve compaction directly from the independently configured `/compact` route.

## Impact

- Affects all code and tests under `dotfiles/pi/agent/extensions/profiles/`, which will move to `dotfiles/pi/agent/extensions/model-routing/`.
- Replaces `~/.local/state/pi/profiles.json` with `~/.local/state/pi/model-routes.json`; `manual-preferences.json` and manual model restoration semantics remain unchanged.
- Removes the `/profile` command without an alias and introduces `/model-routes`.
- Requires updates to the three existing OpenSpec capabilities listed above.
