## Why

Model routing currently overrides Pi's selected model and thinking level on every session start using extension-owned persisted state. Pi should remain the authority for startup, replacement, resumed, forked, and reloaded session selections while model routing only manages temporary route segments and their return target.

## What Changes

- Stop activating an extension-persisted model or thinking level during `session_start`.
- Capture Pi's current model and thinking level as the session baseline selection, with a first-route fallback when no model is available at session start.
- Keep route restoration returning to the session baseline selection and update that baseline after explicit manual selections.
- Remove the obsolete persisted `selection` field while retaining per-model thinking memory.
- Lazily migrate existing preference files by ignoring legacy `selection` data and writing the canonical format on the next manual preference change.
- Rename the domain concept from session manual selection to session baseline selection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-model-routing`: Delegate initial model selection to Pi and redefine route restoration around a non-persisted session baseline selection.

## Impact

- `dotfiles/pi/agent/extensions/model-routing/` session coordination and preference persistence
- Focused model-routing lifecycle, restoration, and migration tests
- `openspec/specs/pi-model-routing/spec.md`
- `CONTEXT.md` model-routing terminology
- Existing `manual-preferences.json` files remain readable; no dependency or Pi API changes
