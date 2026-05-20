## Why

Model profiles are currently fixed in code, so changing which models or thinking levels are used for `default`, `light`, and `heavy` routes requires editing the extension itself. `/model-profile` should become the place where profiles are selected, configured, and repaired using the models Pi can actually run.

## What Changes

- Extend `/model-profile` from a simple profile selector into an interactive profile manager.
- Allow configuring each fixed profile route (`default`, `light`, `heavy`) with a model and thinking level.
- Source selectable models from Pi's available models, not manually typed model IDs.
- Validate persisted profile configuration before enabling routing.
- Disable automatic profile/routing behavior when configuration is missing or invalid, while keeping `/model-profile` available for manual setup or repair.
- Persist complete profile configuration as the source of truth once saved.
- Remove fallback/default profile behavior for missing or invalid persisted configuration.
- Publish model-profile state to the Pi footer instead of using informational notifications for successful profile activation or save events.

## Capabilities

### New Capabilities

- `pi-model-profile-configuration`: Interactive configuration, validation, persistence, and repair behavior for model profiles.

### Modified Capabilities

- `pi-model-routing`: Model routing now depends on a valid persisted profile configuration instead of hardcoded profiles or fallback defaults.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/model-profile/**` and `dotfiles/pi/agent/extensions/footer.ts`.
- Affected state: `model-profile.json` expands from active-profile-only state to full profile configuration state.
- Affected runtime behavior: session default activation, slash-command routing, and post-route restore are disabled when profile configuration is missing or invalid.
- New dependency consideration: validation should use Pi's model availability and supported thinking-level metadata, including `getSupportedThinkingLevels(model)` from `@earendil-works/pi-ai` if available to extensions.
