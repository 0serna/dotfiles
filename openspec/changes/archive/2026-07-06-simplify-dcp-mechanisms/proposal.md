## Why

The DCP context-pruning policy has accumulated four mechanisms with overlapping intent. `duplicate` (same normalized text on non-file tools) and `resolved` (later success cancels earlier error) provide marginal token savings but force extra identity bookkeeping and produce many false positives in practice. The remaining mechanisms — `superseded` and `stale_large` — already cover the high-value cases (older reads replaced by newer reads on the same range, and large old results outside the recent window). Reducing the surface to those two mechanisms, lowering the token gate to 500, and raising the DCP age gate to 25 makes pruning more aggressive in the right places while dropping code paths that are hard to reason about.

## What Changes

- Remove the `duplicate` and `resolved` mechanisms from the DCP pruning policy, type, matrix, and tests (**BREAKING** for any consumer importing `PruneReason`).
- Set `PRUNE_TOKEN_THRESHOLD` from `2000` to `500`.
- Set `STALE_LARGE_MIN_AGE` from `20` to `25`.
- Rename the metric `staleLargeProtectedCount` to `ageGatedCount` to reflect the new threshold/age relationship.
- Update the living spec `pi-dcp-lite-context-pruning` to drop `duplicate`/`resolved` requirements and scenarios and reflect the new thresholds and metric name.
- Add ADR `docs/adr/0001-dcp-simplify.md` recording the decision.
- Rewrite `dotfiles/pi/agent/extensions/context/pruning-matrix.md` to reflect the two-mechanism matrix and the new order/thresholds.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: requirements for `duplicate` and `resolved` removed; `Balance-oriented pruning rules` and `Stale-large age metrics` updated to use `500` tokens, age `25`, and metric `ageGatedCount`.

## Impact

- Code: `dotfiles/pi/agent/extensions/context/types.ts`, `pruning/policy.ts`, `pruning/metrics.ts`, `pruning-matrix.md`, all tests under `pruning/tests/`.
- Specs: `openspec/specs/pi-dcp-lite-context-pruning/spec.md`.
- Docs: `docs/adr/0001-dcp-simplify.md` (new).
- Public API: `PruneReason` union loses `"duplicate"` and `"resolved"`; `PruneMetrics.staleLargeProtectedCount` renamed to `ageGatedCount`. Both are internal to the extension.
- Drift note: the living spec currently says `1000` tokens / `30` age while the code says `2000` / `20`. This change does not fix that pre-existing drift; it supersedes both with `500` / `25`.
