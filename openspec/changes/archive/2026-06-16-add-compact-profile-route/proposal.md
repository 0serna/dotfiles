## Why

Pi compaction currently uses the active/default compaction model behavior, while profile routing already lets the user choose cheaper or stronger models for specific work. Adding an optional compact route lets compaction use a dedicated model without changing the user's active model.

## What Changes

- Add an optional `compact` profile route with the same `{ model, thinkingLevel }` shape as existing routes.
- Use the `compact` route for manual, threshold, and overflow compaction when it is present and valid.
- Fall back to Pi's default compaction when `compact` is absent or invalid.
- Show a warning only when a configured `compact` route is attempted but fails at runtime, then fall back to default compaction.
- Show `compact` in `/profile` as an optional route that can be configured or unset.

## Capabilities

### New Capabilities

- `pi-compact-profile-route`: Dedicated model route behavior for Pi compaction.

### Modified Capabilities

- `pi-model-profile-configuration`: Profile configuration and editor support an optional `compact` route that does not affect validity of required routes.

## Impact

- Affects `dotfiles/pi/agent/extensions/profiles/` configuration, validation, UI, and extension event handling.
- Uses Pi's documented `session_before_compact` hook and official compaction helper.
- No new external dependencies.
