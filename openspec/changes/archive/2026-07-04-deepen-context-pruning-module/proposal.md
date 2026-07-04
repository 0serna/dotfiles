## Why

Context pruning currently has a small external interface, but its implementation details are spread across shallow helper modules and a large orchestration file. This makes the pruning rules harder to navigate and reduces locality for future changes.

## What Changes

- Keep `pruneMessages(messages, options)` as the single public context pruning interface.
- Reorganize the context pruning implementation behind internal seams for candidate collection, decision policy, stub application, and metrics.
- Preserve all existing context pruning behavior, metrics, fail-open semantics, and tests.
- Add no new pruning mechanisms, tool policies, or user-facing behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: clarify that context pruning remains exposed through one stable pruning interface and preserves fail-open behavior during implementation refactoring.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/prune.ts`, `metadata.ts`, `content.ts`, `types.ts`, and new internal files under `dotfiles/pi/agent/extensions/context/pruning/`.
- Affected tests: existing context pruning tests under `dotfiles/pi/agent/extensions/context/tests/` should continue to pass through `pruneMessages`.
- No public interface, dependency, configuration, or spec behavior changes.
