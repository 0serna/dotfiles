## 1. ThroughputTracker module

- [x] 1.1 Create `working-time/throughput.ts` with `ThroughputTracker` state machine (idle → streaming → final)
- [x] 1.2 Port `estimateTokensFromDelta`, `computeThroughput`, `formatThroughput`, `isOutputDeltaEvent` from `tps/core.ts` as module-private helpers
- [x] 1.3 Implement `getDisplay()` returning `"N tok/s"` (live), `"N tok/s (last)"` (final), or `null` (idle)
- [x] 1.4 Create `working-time/tests/throughput.test.ts` with unit tests for all states and transitions

## 2. Merge into working-time extension

- [x] 2.1 Add `message_update` and `message_end` hooks to `working-time/index.ts`
- [x] 2.2 Unify interval: single `setInterval` at 1s updates both elapsed time and throughput
- [x] 2.3 Compose working message with throughput: `Working Xm Ys · N tok/s [(last)]` or placeholder `- tok/s`
- [x] 2.4 Remove all `setStatus` calls; throughput only in `setWorkingMessage`
- [x] 2.5 Update `working-time/tests/extension.test.ts` with throughput display scenarios

## 3. Remove tps extension

- [x] 3.1 Delete `tps/` directory (index.ts, core.ts, tests/)
- [x] 3.2 Verify no remaining imports reference `tps/`

## 4. Quality gate

- [x] 4.1 Run `npm run check` and fix any failures
- [x] 4.2 Verify both extensions work correctly in a live Pi session
