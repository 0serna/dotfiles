## Why

DCP currently uses a global recent-message protection window, so ignored tools such as `question` can indirectly change pruning behavior by occupying protected-message slots. The size-based `old_large_output` rule also needs a clearer age gate because it is less semantically certain than duplicate, resolved-error, or superseded-operation pruning.

## What Changes

- Remove the global recent-message protection model from DCP pruning.
- Count DCP age using only eligible, non-ignored `toolResult` messages instead of all context messages.
- Keep ignored tools such as `question` outside pruning, metrics, and DCP age/window calculations.
- Allow semantic pruning rules to apply immediately when their conditions are met:
  - `duplicate_output`
  - `resolved_error`
  - `superseded_file_operation`
- Restrict `superseded_file_operation` to later file operations with the same normalized tool and same normalized target.
- Gate `old_large_output` behind a dedicated age window and a more conservative size threshold.
- Rename recent-protection metrics to represent the `old_large_output` age gate rather than a global protection window.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: Refine DCP pruning requirements for ignored tools, age calculation, superseded file operations, and size-based pruning.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/prune.ts`, `types.ts`, and pruning tests.
- Affected specs: `openspec/specs/pi-dcp-lite-context-pruning/spec.md`.
- No new runtime dependencies or user-facing commands.
