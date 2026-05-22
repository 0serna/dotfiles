## Why

Compaction (manual `/compact` and auto-compaction) calls the LLM to generate a conversation summary. Today it uses the session's active model, which is often an expensive reasoning model. Since summarization doesn't require heavy reasoning, switching to the profile's `light` model during compaction saves cost without sacrificing quality.

## What Changes

- The profiles extension subscribes to `session_before_compact` and `session_compact` events.
- Before compaction, if valid profile configuration is active and no command-based route is currently in progress, the extension switches to the profile's `light` model and thinking level.
- After compaction completes, the extension restores the model and thinking level that were active before the switch.
- If a command-based route (e.g. `/opsx-propose` heavy) is active when compaction triggers, the extension skips the light-model switch and lets compaction use the current routed model. This is an acknowledged rare edge case.

## Capabilities

### New Capabilities

- `compact-light-routing`: Automatic routing of compaction summarization to the profile's light model with snapshot-based state restoration.

### Modified Capabilities

- `pi-model-routing`: New requirement for compaction-triggered routing alongside existing slash-command and session-start routing.

## Impact

- `dotfiles/pi/agent/extensions/profiles/index.ts`: New `session_before_compact` and `session_compact` event handlers.
- `dotfiles/pi/agent/extensions/profiles/runtime.ts`: New `compactSnapshot` state variable and accessor methods (`markCompactSnapshot`, `hasCompactSnapshot`, `consumeCompactSnapshot`).
- No API, dependency, or external-system changes.
