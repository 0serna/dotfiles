# Simplify DCP pruning to superseded + stale_large

DCP pruning keeps only the two high-value mechanisms (`superseded` and `stale_large`), drops `duplicate` and `resolved`, and tunes the size/age gates to `500` tokens and `25` DCP age. The metric `staleLargeProtectedCount` is renamed to `ageGatedCount`.

## Context

The DCP context-pruning policy had four mechanisms. `duplicate` (same normalized text on non-file tools) and `resolved` (later success cancels earlier error) forced extra identity bookkeeping — `laterContentHashesByIndex` and `laterSuccessOperationsByIndex` in `pruning/policy.ts` — for marginal savings. `superseded` (later same-identity file op replaces older) and `stale_large` (large old results outside the recent window) already cover the high-value cases.

## Decision

- `PruneReason` is reduced to `"superseded" | "stale_large"`.
- `duplicate` and `resolved` are removed from `TOOL_PRUNING_POLICY` and from `decideStubs`.
- `PRUNE_TOKEN_THRESHOLD` is `500` (down from `2000`); `STALE_LARGE_MIN_AGE` is `25` (up from `20`).
- `PruneMetrics.staleLargeProtectedCount` is renamed to `ageGatedCount`; semantics are unchanged.
- Spec `pi-dcp-lite-context-pruning` is updated to remove `duplicate`/`resolved` requirements and the obsolete scenarios.
- `pruning-matrix.md` is rewritten to reflect the two-mechanism matrix and the new thresholds.

## Status

accepted

## Considered Options

- Keep `duplicate` and `resolved` as opt-in flags per tool — rejected: keeps the identity helpers in the codebase without changing user-visible behavior.
- Make thresholds configurable via Pi settings — rejected: violates the "smallest correct implementation" principle and adds a public API for a tuning knob.
- Rename `staleLargeProtectedCount` to `staleNearMissCount` or `sizeThrottledCount` — rejected: `ageGatedCount` describes the dominant gate (age) given the new threshold relationship.

## Consequences

- Outputs between `500` and `2000` tokens that pass age `25` will now be stubbed (`stale_large`).
- `bash` and `web_fetch` no longer deduplicate identical text outputs.
- `bash` no longer trims earlier errors when a later success exists.
- `PruneReason` and `PruneMetrics` are breaking for any external importer; today the extension is the only consumer.
- The pre-existing drift between the living spec (`1000` / `30`) and the code (`2000` / `20`) is not addressed by this change; both are superseded by `500` / `25`.
