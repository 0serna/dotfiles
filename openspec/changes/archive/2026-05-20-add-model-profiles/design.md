## Context

The current Pi model routing extension is a single-file extension that applies one fixed default model route on most session starts and temporarily switches models for selected slash-prompt workflows. It restores the pre-route model snapshot after those workflows finish. The desired behavior is to make routing profile-based so the user can switch between normal mixed usage and OpenCode-only usage without editing extension code.

The existing quota extension is out of scope. Profile selection belongs to the model routing/profile extension and uses `/model-profile`, not `/quota`.

## Goals / Non-Goals

**Goals:**

- Represent routing as named profiles, each with `default`, `light`, and `heavy` routes.
- Provide an interactive `/model-profile` command that selects and immediately activates a profile.
- Persist the selected profile globally in XDG state so it survives restarts and reloads.
- Rename/restructure the extension to `extensions/model-profile/index.ts`.
- Return to the active profile's default route after temporary route execution.

**Non-Goals:**

- Do not change the quota footer extension.
- Do not add argument parsing or autocompletion for `/model-profile`.
- Do not add dynamic model discovery or provider-specific quota automation.
- Do not change the manual model-select behavior that resets thinking level to `medium`.

## Decisions

### Use model profiles as the source of truth

The extension will define named profiles where each profile contains `default`, `light`, and `heavy` routes. This avoids parallel arrays whose indices can become misaligned and matches the user-facing concept selected by `/model-profile`.

Alternatives considered:

- Parallel `DEFAULT_MODEL[]`, `LIGHT_MODEL[]`, and `HEAVY_MODEL[]` arrays: closer to the first phrasing, but easier to desynchronize.
- A hybrid derived structure: unnecessary indirection for this small extension.

### Persist profile name in XDG state

The active profile will be stored as a stable profile name under `${XDG_STATE_HOME:-~/.local/state}/pi/model-profile.json`. Storing the name rather than an index keeps the persisted state stable if profiles are reordered.

Alternatives considered:

- `~/.pi/agent/model-profile.json`: visible but mixes mutable runtime state with agent configuration.
- XDG config: better for declarative configuration, but this value is command-mutated state.
- XDG cache: not durable enough for a preference that should survive restarts.

### `/model-profile` is interactive only

The command will show a selector for available profiles. It will not accept direct arguments in the initial version, keeping the surface area small and discoverable.

### Selecting a profile updates state even when activation fails

When the user selects a profile, the extension persists the selection and attempts to activate the profile default. If the model is unavailable, the selected profile remains active and the UI shows a warning. This preserves user intent through temporary provider/configuration failures.

### Session reload applies the active profile default

Unlike the current reload behavior, `session_start` for reload will also read persisted state and attempt to activate the active profile default. The persisted profile becomes the source of truth whenever the extension starts.

### Temporary routes return to profile default

After a routed slash command completes, the extension will activate the active profile's default route instead of restoring the pre-route model snapshot. This makes the selected profile the canonical home state.

### Manual model selection remains independent

The existing manual model-select/cycle behavior will continue to set thinking level to `medium`. Manual model changes do not update the persisted model profile.

## Risks / Trade-offs

- Persisted profile names can become invalid after future profile edits → fall back to `mixed` when loading unknown or unreadable state.
- Applying the active profile on reload can unexpectedly change the current model → this is intentional so reload reconciles with persisted profile state.
- Saving a profile even when activation fails can leave the UI on a different current model than the active profile default → show a warning and retry activation on future session starts/reloads or route cleanup.
- Renaming the extension path may leave stale local files if both old and new files exist during manual deployment → ensure the old `model-routing.ts` file is removed as part of implementation.
