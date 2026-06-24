## Why

Temporary route activation uses Pi's model selection API, which persists the routed model as Pi's default. If another Pi session starts while a route is active, it may initially select the routed model instead of the user's last manual selection.

## What Changes

- Persist the user's last manual model and thinking-level selection in the profiles extension state.
- Restore the persisted user selection when a new session starts, even if Pi starts with a route-contaminated default.
- Continue restoring the user selection after routed commands complete.
- Keep routed model and thinking changes out of the persisted user selection.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-model-routing`: User selection restoration becomes durable across Pi sessions and independent of Pi's default model setting.

## Impact

- Affects the Pi profiles extension under `dotfiles/pi/agent/extensions/profiles/`.
- Adds or extends extension-owned persisted state for the last manual user model and thinking level.
- Updates route restoration tests to cover session startup restoration from extension state.
