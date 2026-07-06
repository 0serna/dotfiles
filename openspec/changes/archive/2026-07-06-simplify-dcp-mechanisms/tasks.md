## 1. Types and constants

- [ ] 1.1 In `dotfiles/pi/agent/extensions/context/types.ts` set `PRUNE_TOKEN_THRESHOLD = 500` and `STALE_LARGE_MIN_AGE = 25`.
- [ ] 1.2 Reduce `PruneReason` union to `"superseded" | "stale_large"`.
- [ ] 1.3 Rename `PruneMetrics.staleLargeProtectedCount` field to `ageGatedCount`.

## 2. Policy and decision logic

- [ ] 2.1 In `dotfiles/pi/agent/extensions/context/pruning/policy.ts` remove `duplicate` and `resolved` from every `TOOL_PRUNING_POLICY` Set.
- [ ] 2.2 Remove the `duplicate` and `resolved` branches from `decideStubs` and drop the `laterContentHashesByIndex` and `laterSuccessOperationsByIndex` helpers and their usage.

## 3. Metrics

- [ ] 3.1 In `dotfiles/pi/agent/extensions/context/pruning/metrics.ts` drop `duplicate` and `resolved` from `emptyReasonCounts` and rename the field calculation to `ageGatedCount`.

## 4. Documentation

- [ ] 4.1 Rewrite `dotfiles/pi/agent/extensions/context/pruning-matrix.md` to show only `superseded` and `stale_large` with the 500/25 thresholds and the new mechanism order.
- [ ] 4.2 Create `docs/adr/0001-dcp-simplify.md` with the decision, alternatives considered, and consequences.

## 5. Tests

- [ ] 5.1 Update `dotfiles/pi/agent/extensions/context/tests/prune-policy.test.ts` for the reduced `PruneReason` set and the new thresholds.
- [ ] 5.2 Update `dotfiles/pi/agent/extensions/context/tests/prune-mechanisms.test.ts` to drop `duplicate`/`resolved` cases and to use 500/25.
- [ ] 5.3 Update `dotfiles/pi/agent/extensions/context/tests/prune-metrics.test.ts` to use `ageGatedCount` and the new thresholds.
- [ ] 5.4 Update `dotfiles/pi/agent/extensions/context/tests/prune-externalization.test.ts` for the new mechanism set and thresholds.
- [ ] 5.5 Add at least one test in `prune-mechanisms.test.ts` asserting that `bash` no longer deduplicates identical text outputs and no longer replaces earlier errors when a later success exists.

## 6. Apply and verify

- [ ] 6.1 Apply the change to the living spec in `openspec/specs/pi-dcp-lite-context-pruning/spec.md` and verify the scenario count matches the new spec.
- [ ] 6.2 Run `npm run check` and `npm test` and confirm the gate is green.
