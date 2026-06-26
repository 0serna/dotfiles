## Why

Long sessions with many tool calls can retain stale medium-to-large tool results longer than necessary, increasing transient context size and contributing to cache instability. Recent session analysis showed that the context pruning extension saved substantial tokens, but a conservative recent-message window and command-specific large-output classification left additional stale tool results unpruned.

## What Changes

- Reduce the protected recent-message window from 20 messages to 15 messages.
- Reduce the large-output pruning threshold from 2000 estimated tokens to 1500 estimated tokens.
- Make large-output pruning tool-agnostic for textual tool results outside the protected window.
- Keep the explicit exclusion for `question` tool results.
- Keep existing file-operation supersession behavior for `read`, `edit`, and `write`.
- Avoid project-specific or tool-specific pruning rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: tune protected-window and large-output pruning requirements for tool-agnostic stale result removal.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/*`.
- Affected tests: context DCP pruning tests.
- No new dependencies.
- No persisted session format changes; pruning remains transient context-only behavior.
