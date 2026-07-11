## Why

Pi can emit an automatic `thinking_level_select` clamp while a manual model switch is still in progress, before the corresponding `model_select` event. The profiles extension currently receives those callbacks separately and must infer their relationship through mutable session state, which allowed a clamp such as `max` to overwrite the user's remembered `high` preference. The recent regression exposed that event attribution and ordering need one local owner.

## What Changes

- Deepen the selection transition module so model and thinking-level events are interpreted as one ordered transition.
- Keep automatic thinking-level clamps caused by a model switch out of manual preference persistence.
- Replace `user-selection.json` and `thinking-memory.json` with one `manual-preferences.json` record containing the current manual selection and per-model thinking memory.
- Preserve manual model selection behavior: apply remembered thinking levels and persist the resulting manual preference state.
- Preserve manual thinking-level behavior: update the current selection and the per-model memory together.
- Keep route activation, route restoration, and session-start restoration excluded from manual preference persistence.
- Keep `profiles.json` separate because it stores automatic route configuration and has a different lifecycle.
- Perform a one-time manual migration of the existing two files; do not ship runtime legacy or migration code.
- Move Pi callback registration toward a thin adapter over the transition module; do not add event listeners.
- Add regression coverage for clamp ordering, manual selection, route suppression, unified state writes, and transition lifecycle state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `per-model-thinking-memory`: clarify that an automatic thinking-level clamp emitted during a model transition is not a manual preference change, while the remembered level is applied after the target model is selected.
- `pi-model-routing`: clarify that automatic model-switch clamps must not overwrite the persisted user selection, while the completed manual model selection remains the persisted user state.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/profiles/index.ts`, `route-session.ts`, and focused profiles tests.
- Persisted manual preference state changes from two files to `manual-preferences.json`; `profiles.json` remains unchanged.
- Existing state is migrated manually before the new implementation is used; old files are removed after migration.
- No runtime legacy path, migration dependency, or new external dependency is introduced.
- No new Pi event listeners are required.
- Existing route activation and restoration behavior must remain compatible with the unified manual preference source of truth.
