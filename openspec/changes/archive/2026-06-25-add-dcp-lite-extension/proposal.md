## Why

Long Pi sessions accumulate stale tool outputs that consume context tokens and can distract the model. A lightweight DCP extension can reduce context bloat automatically without adding tools, prompts, commands, or user/model decisions.

## What Changes

- Add a new Pi extension named DCP under `dotfiles/pi/agent/extensions/dcp/`.
- Automatically replace stale `toolResult` content with compact informational stubs during the `context` event.
- Preserve session history by pruning only the transient context sent to the model.
- Protect recent conversation context and avoid modifying user or assistant messages.
- Use the repository's shared extension logger and write structured metrics to `dcp.log`.
- Fail open by returning the original context if pruning cannot be safely completed.

## Capabilities

### New Capabilities

- `pi-dcp-lite-context-pruning`: Automatic, invisible, non-destructive context pruning for stale Pi tool results.

### Modified Capabilities

## Impact

- Adds a new Pi extension directory at `dotfiles/pi/agent/extensions/dcp/`.
- Uses the existing shared logger from `dotfiles/pi/agent/extensions/shared/logger.ts`.
- Affects Pi runtime context construction only; saved session entries and existing tools remain unchanged.
- No new model-callable tools, commands, prompts, package dependencies, or user-facing UI are introduced.
