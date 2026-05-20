## 1. Extension Structure

- [x] 1.1 Create `dotfiles/pi/agent/extensions/model-profile/index.ts` from the existing model routing extension behavior.
- [x] 1.2 Remove the old `dotfiles/pi/agent/extensions/model-routing.ts` entry so only the renamed extension loads.

## 2. Profile Model and State

- [x] 2.1 Define named `mixed` and `opencode-only` profiles with `default`, `light`, and `heavy` routes.
- [x] 2.2 Add active profile lookup with `mixed` as the fallback for missing or invalid persisted state.
- [x] 2.3 Add XDG state read/write helpers for `${XDG_STATE_HOME:-~/.local/state}/pi/model-profile.json`.

## 3. Profile Activation

- [x] 3.1 Update session start handling, including reload, to load the active profile and activate its default route.
- [x] 3.2 Update slash-command routing to resolve light/heavy routes from the active profile.
- [x] 3.3 Update route completion handling to activate the active profile's default route and thinking level.
- [x] 3.4 Preserve manual model-select behavior that resets thinking level to `medium`.

## 4. `/model-profile` Command

- [x] 4.1 Register an interactive `/model-profile` command that lists available profile names.
- [x] 4.2 Persist the selected profile and attempt to activate its default route immediately.
- [x] 4.3 Show a warning when selected profile activation fails while keeping the profile selected.

## 5. Verification

- [ ] 5.1 Update or add tests covering profile selection, persistence fallback, reload activation, routed model selection, and return-to-default behavior.
- [ ] 5.2 Run the repository quality gate with `npm run check`.
