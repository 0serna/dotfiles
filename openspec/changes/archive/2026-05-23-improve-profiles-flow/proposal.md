## Why

The `/profiles` flow currently mixes activation and editing in ways that make navigation feel ambiguous, especially because `Enter` changes behavior based on configuration state. The command should feel like a compact profile management panel where editing is the primary action and activation is explicit but secondary.

## What Changes

- Make the profile list navigation consistent:
  - `Enter` edits the selected profile.
  - `Space` activates the selected profile when configuration is valid.
  - `Esc` closes the profile manager.
- Present configuration status as one global message instead of repeating setup/repair tags on every profile row.
- Keep the editor direct and compact, without adding a separate detail screen.
- Keep `low`, `medium`, and `high` route names visible without per-route descriptions.
- Keep route editing as a two-step `model -> thinking` selection flow with clearer prompts.
- Keep editor `Esc` behavior as save-and-return, but make the key hint explicit.
- Show success feedback only when a profile is activated; save success remains silent unless there are errors.
- Keep all visible `/profiles` text in English with compact contextual wording.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-model-profile-configuration`: Clarify `/profiles` profile manager keyboard actions, status messaging, save navigation, and activation feedback behavior.
- `pi-model-routing`: Align interactive profile activation behavior with the updated `/profiles` navigation where activation is an explicit secondary action.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/profiles/ui.ts` and `dotfiles/pi/agent/extensions/profiles/command.ts`.
- Affected specs: `pi-model-profile-configuration` and `pi-model-routing`.
- No changes to persisted configuration shape, fixed profile names, fixed route names, route mappings, model activation semantics, dependencies, or command registration.
