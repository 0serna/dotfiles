## Why

Long tool-heavy Pi sessions currently replace pruned tool outputs with in-context stubs that permanently discard the original text from the model-visible branch. This saves tokens, but makes pruning riskier when an older large output becomes relevant again, and current metrics can count stubs that do not actually save tokens.

## What Changes

- Externalize pruned tool output text above a global token threshold to per-session temporary files and replace the context content with a minimal recoverable stub.
- Lower the pruning size threshold to 1000 estimated tokens and apply it to every pruning mechanism.
- Increase the `stale_large` age gate to 30 DCP-ageable tool results while leaving `duplicate`, `resolved`, and `superseded` eligible from the start.
- Skip pruning decisions when the replacement stub would not save tokens.
- Log cache status only on `turn_end` to avoid duplicate final `cache_status` events.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: DCP pruning thresholds, recoverable externalized stubs, and positive-savings-only pruning behavior change.
- `cache-hit-monitoring`: Cache status logging is restricted to turn-end logging to avoid duplicate lifecycle logs.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/prune.ts`, `types.ts`, `index.ts`, `status.ts`, and related tests.
- Affected artifacts: `dotfiles/pi/agent/extensions/context/pruning-matrix.md` and OpenSpec specs for DCP pruning and cache monitoring.
- Runtime impact: pruned outputs above threshold are written under a temporary per-session DCP directory; the extension does not clean these files automatically.
