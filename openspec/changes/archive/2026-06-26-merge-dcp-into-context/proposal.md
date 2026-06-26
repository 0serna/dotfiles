## Why

DCP pruning and cache-hit monitoring both operate on Pi context behavior, but they currently emit separate extension logs. Merging DCP into the context extension will make it easier to correlate pruning decisions with subsequent cache-hit outcomes.

## What Changes

- Move DCP pruning runtime behavior into the existing `context` extension.
- Remove the standalone `dcp` extension after migration.
- Keep pruning logic modular and testable inside `dotfiles/pi/agent/extensions/context/` as flat modules.
- Add a context status segment for the latest estimated DCP token savings in the order `ctx saved cache`.
- Log DCP pruning and cache status events to the unified `context` log.
- Include the latest DCP metrics in cache status log payloads for direct correlation.
- Add baseline tests for pure context formatting/computation behavior before migrating runtime logic.
- **BREAKING**: Any external explicit loading of the standalone `dcp` extension will no longer work after the extension directory is removed.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: DCP remains automatic and non-destructive, but is owned by the `context` extension, logs under `context`, reports fail-open prune errors, and exposes latest savings to context status.
- `cache-hit-monitoring`: Cache status/logging includes latest DCP metrics and the status format adds a `saved Xk` segment between context usage and cache hit rate.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/*` and `dotfiles/pi/agent/extensions/dcp/*`.
- Affected tests: DCP pruning tests move/update to the context extension; new pure-function context baseline tests are added.
- Affected logs: pruning events move from `~/.local/state/pi/dcp.log` to `~/.local/state/pi/context.log`.
- No new dependencies or external services are required.
