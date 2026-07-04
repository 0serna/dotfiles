## 1. Preserve Baseline

- [x] 1.1 Run the existing context pruning tests and note the current green baseline
- [x] 1.2 Identify all current public imports of `pruneMessages` and confirm callers do not depend on internal helpers

## 2. Internal Module Structure

- [x] 2.1 Create `dotfiles/pi/agent/extensions/context/pruning/` for internal pruning implementation seams
- [x] 2.2 Move candidate collection logic behind an internal candidate collection seam
- [x] 2.3 Move pruning policy and decision logic behind an internal policy seam
- [x] 2.4 Move metrics calculation behind an internal metrics seam
- [x] 2.5 Move saved-path selection, externalization, and message replacement behind an internal stub application seam

## 3. Public Interface

- [x] 3.1 Keep `dotfiles/pi/agent/extensions/context/prune.ts` as the public orchestration module exporting `pruneMessages`
- [x] 3.2 Preserve fail-open behavior that returns original messages and empty metrics on unexpected pruning errors
- [x] 3.3 Keep the existing `PruneResult`/`PruneOptions` caller contract compatible with current imports

## 4. Verification

- [x] 4.1 Run all context pruning tests and fix any behavior drift
- [x] 4.2 Run the full repository test suite
- [x] 4.3 Run the full repository check suite
