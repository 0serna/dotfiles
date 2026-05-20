## Context

The current model-profile extension has fixed profile definitions in code and persists only the active profile name. Routing behavior assumes a valid profile is always available by falling back to a configured profile when state is missing or invalid.

The desired behavior makes profile configuration user-controlled. `/model-profile` becomes both the profile selector and the configuration/repair surface. Missing or invalid configuration must not silently fall back to hardcoded routes; it must disable automatic routing and let Pi retain control of the current model until the user creates or repairs a valid configuration.

## Goals / Non-Goals

**Goals:**

- Let users configure the model and thinking level for each fixed profile route.
- Use Pi's available model list for model selection and validation.
- Validate thinking levels against each selected model's supported thinking levels.
- Treat persisted profile configuration as the source of truth when valid.
- Disable automatic routing/default activation when persisted configuration is missing or invalid.
- Keep `/model-profile` available as a setup and repair UI when routing is disabled.
- Preserve profile activation semantics: activating a profile applies its default route immediately.

**Non-Goals:**

- Creating, renaming, or deleting profiles.
- Creating, renaming, or deleting route kinds.
- Providing reset-to-default behavior.
- Automatically bootstrapping an initial configuration.
- Persisting partial setup drafts.

## Decisions

### Persist complete profile configuration

Persist the full configured profile set instead of storing overrides on top of code defaults. This makes user configuration explicit and eliminates hidden fallback behavior.

Alternatives considered:

- Code defaults plus overrides: easier migration path, but conflicts with the chosen no-defaults model.
- Active profile only: insufficient once route models and thinking levels are user-configurable.

### Disable routing when configuration is missing or invalid

The extension will have an enabled mode only when persisted state is complete and valid. Missing state, invalid JSON, incomplete schema, unavailable models, invalid thinking levels, unsupported model/thinking combinations, and invalid active profile names put the extension into disabled routing mode.

In disabled routing mode:

- session-start default activation is skipped;
- slash-command routing is skipped;
- post-route default restore is skipped;
- `/model-profile` remains available for setup or repair.

### Validate against available models and supported thinking levels

Model choices come from `ctx.modelRegistry.getAvailable()`, ensuring selected models are usable with configured credentials. Thinking-level validation should use Pi's model metadata via `getSupportedThinkingLevels(model)` from `@earendil-works/pi-ai` so extension behavior stays aligned with Pi's own model capability rules.

Alternative considered:

- Accept known thinking-level strings and let Pi clamp. This was rejected because it would allow configurations that save successfully but activate differently than configured.

### Use a custom TUI for profile management

`ctx.ui.select()` is too limited because the profile list needs two actions: Enter to activate and Space to edit. A custom TUI should visually match Pi's built-in select style as closely as practical while adding profile-management actions.

Main profile view:

- Enter activates the selected profile.
- Space edits the selected profile.
- The active profile is visually marked.

Editor view:

- Shows fixed routes for the selected profile.
- Displays model and thinking level for each route.
- Shows `[unset]` for missing setup values and marks invalid recovered values in repair mode.
- Saves only when the full configuration is complete and valid.

### Apply saved changes only for the active profile

Saving changes to an inactive profile persists the configuration without changing the current active profile or current model. Saving changes to the active profile refreshes the active profile by applying its configured default route immediately.

Alternative considered:

- Saving any profile also activates it. This was rejected because editing a future profile should not unexpectedly change the current model context.

### Publish profile status in the footer

The extension publishes a `model-profile` footer status instead of normal informational notifications for profile activation or save events. The status is shown by the custom footer after the current directory/branch and before the model section.

Status values:

- valid and applied configuration: `profile <name>` using dim styling;
- missing configuration: `profile setup` using warning styling;
- invalid configuration: `profile invalid` using warning styling;
- valid configuration whose default route could not be activated: `profile failed` using warning styling.

Temporary slash-command routing does not change the profile status because the active profile itself does not change.

### Warn without spamming

When configuration is missing or invalid, warn once per session. `/model-profile` shows setup/repair state in the TUI rather than emitting an additional warning when opened. This makes the disabled state visible without notifying on every input or duplicating the TUI state.

## Risks / Trade-offs

- Custom TUI complexity → Keep the component focused on a small fixed data model: two profiles, three routes, model/thinking fields.
- Runtime import of `@earendil-works/pi-ai` helper may fail if extension resolution differs from package resolution → Verify import availability during implementation and fall back to equivalent local validation only if necessary.
- Strict validation can disable routing when credentials change → This is intentional; warnings and repair mode provide a recovery path.
- No automatic bootstrap means first use has no routing → This is intentional to avoid hidden defaults; `/model-profile` provides manual setup.
- No reset behavior means reverting requires manual edits → This matches the chosen no-defaults model.
