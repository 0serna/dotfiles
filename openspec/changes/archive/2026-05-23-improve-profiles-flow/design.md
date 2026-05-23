## Context

The profiles extension provides a `/profiles` command for configuring fixed model profiles and routes. The current UI uses a profile list plus a route editor, but the profile list makes `Enter` activate a profile when configuration is valid and edit a profile when configuration is missing or invalid. This makes the command feel like a selector in some states and a configuration panel in others.

The existing implementation already separates most concerns cleanly:

- `ui.ts` renders the profile list, route editor, and selection prompts.
- `command.ts` interprets UI results, persists configuration, and activates profiles.
- `routing.ts`, `runtime.ts`, and state validation should not need semantic changes.

## Goals / Non-Goals

**Goals:**

- Make `/profiles` feel consistently like a profile management/configuration panel.
- Make editing the primary profile-list action and activation an explicit secondary action.
- Keep the UI compact and English-only.
- Preserve existing persistence, validation, profile names, route names, route mappings, and route editing sequence.
- Improve action hints, status messages, and user feedback without introducing a larger UI architecture.

**Non-Goals:**

- Do not change the persisted `profiles.json` schema.
- Do not add, remove, or rename fixed profiles or routes.
- Do not add a profile detail screen or a read-only inspection mode.
- Do not change automatic model routing behavior for slash commands, session start, agent end, or compaction.
- Do not replace Pi's built-in model/thinking select prompts with a custom picker.

## Decisions

### Use `Enter` for edit and `Space` for activation

The profile list will treat editing as the default action: `Enter` opens the selected profile editor in every configuration state. Activation uses `Space`, which is free now that `Enter` always edits.

Alternatives considered:

- Keep `Enter` as activation when valid: preserves current behavior but retains ambiguity.
- Use `A` for activation: communicates intent but letter keys in terminal TUI can conflict with input modes.
- Add activation confirmation: safer but excessive because activation is not destructive.

### Show configuration state as a global message

The profile-list frame will show one contextual status line for `valid`, `missing`, or `invalid` configuration. Per-profile setup/repair tags will be removed because the state applies to the full configuration, not to individual profile rows.

Alternatives considered:

- Keep tags on every profile row: visible but noisy and misleading.
- Show both global and row-level state: too verbose for a compact terminal UI.

### Preserve direct editor navigation

Selecting a profile with `Enter` will continue to open the route editor directly. No detail screen will be introduced.

Alternatives considered:

- Add a view/detail screen before editing: clearer but adds a step and a new mode.
- Combine profile list and route details in one screen: richer but more complex and harder to keep compact.

### Preserve `Esc` as save-and-return in the editor

The route editor will keep the current save-on-escape behavior, but key hints and error messages will make it explicit. If any route is incomplete, `Esc` will keep the user in the editor and show a compact warning.

Alternatives considered:

- Make `Esc` cancel/back and add an explicit save key: more conventional but a larger behavior change.
- Save each route immediately: simpler persistence model for the user but changes draft semantics.

### Keep route editing as `model -> thinking`

Editing a route will continue to require selecting the model first and then selecting a supported thinking level. This avoids adding a field-selection step and keeps implementation surgical.

Alternatives considered:

- Add a field menu for model vs thinking: more flexible, but more navigation.
- Add separate hotkeys for model and thinking: efficient but less discoverable.

### Activation feedback is explicit; save success is quiet

Successful activation will show a concise notification because it immediately changes the active profile and low route. Successful save will return silently to the profile list because the updated list/footer status is sufficient and avoids noisy edit cycles.

Alternatives considered:

- Notify on both activation and save: explicit but noisy.
- Notify only on failures: clean but activation can feel invisible.

## Risks / Trade-offs

- `Esc` still means save in the editor, which differs from common terminal expectations. → Mitigate with explicit key hints such as `Esc save profile & return` and warnings when save cannot proceed.
- Users who expect `Enter` to activate from the existing flow will need to learn `Space`. → Mitigate by making the profile-list help text compact and visible.
- Keeping `model -> thinking` means changing only thinking still requires reselecting the model. → Accepted to keep this change focused on text/navigation clarity.
- The OpenSpec specs refer to `/model-profile` while the implementation command is `/profiles`. → This change updates behavior semantics without renaming the broader model-profile capability.
