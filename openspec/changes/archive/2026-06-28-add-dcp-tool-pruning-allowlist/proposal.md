## Why

DCP currently prunes any non-ignored textual tool result, so future tools can be pruned before their output semantics are reviewed. This risks silently removing important context from new or custom tools.

## What Changes

- Require each prunable tool and pruning mechanism combination to be explicitly allowlisted.
- Preserve the current reviewed policies for `read`, `edit`, `write`, `bash`, `web_fetch`, and `web_search`.
- Keep `question` and `multi_tool_use.parallel` unpruned.
- Remove generic pruning behavior for unlisted textual tools.
- Update the pruning matrix to remove `Other textual tools`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: DCP pruning eligibility changes from generic textual-tool pruning to explicit tool/mechanism allowlisting.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/` pruning policy, tests, and pruning matrix.
- Affected specs: `openspec/specs/pi-dcp-lite-context-pruning/spec.md`.
- No new dependencies or external APIs.
