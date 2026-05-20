## Why

Pi model routing currently has a single fixed default/light/heavy configuration, which makes it awkward to switch between normal mixed usage and quota-conserving OpenCode-only usage. A persisted model profile selector lets the user change routing behavior deliberately without editing extension code.

## What Changes

- Replace fixed model route constants with named model profiles that each define `default`, `light`, and `heavy` routes.
- Add an interactive `/model-profile` command for selecting the active profile.
- Persist the active profile globally using XDG state so it survives restarts and reloads.
- Activate the selected profile's default route immediately after selection and during session startup/reload.
- Change temporary route cleanup to return to the active profile's default route instead of restoring the pre-route model snapshot.
- Rename/restructure the extension from `model-routing.ts` to `model-profile/index.ts`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-model-routing`: Model routing will support persisted named profiles, an interactive profile selector, reload activation, and profile-default restoration after temporary routes.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/model-routing.ts`, renamed/restructured under `dotfiles/pi/agent/extensions/model-profile/index.ts`.
- Affected behavior: Pi session startup, reload, temporary slash-command routing, and manual model profile selection.
- Affected state: new persisted state file at `${XDG_STATE_HOME:-~/.local/state}/pi/model-profile.json`.
- No new external dependencies are expected.
