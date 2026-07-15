## 1. Characterize the seams

- [x] 1.1 Add failing account-selection interface tests covering snapshot startup, blind fallback, idle-only preventive reselection, quota-error rotation, full processing-cycle exhaustion, and settlement reset.
- [x] 1.2 Add failing quota-refresh interface tests covering fresh and stale startup, incremental source publication, lease contention, shared exhaustion recording, watcher convergence, and shutdown.
- [x] 1.3 Add a failing isolation test that constructs two quota-refresh instances with different temporary state directories and proves their snapshot and lease paths do not interfere.

## 2. Deepen OpenCode account selection

- [x] 2.1 Define normalized account-selection facts, outcomes, owned state, and construction dependencies without importing Pi extension context types.
- [x] 2.2 Implement startup selection, blind fallback, cooldowns, account activation decisions, and snapshot-driven preventive reselection inside the account-selection module.
- [x] 2.3 Implement provider-confirmed exhaustion, processing-cycle attempted-account tracking, reactive rotation, continuation gating, settlement reset, and shutdown inside the account-selection module.
- [x] 2.4 Convert `quota/index.ts` into the Pi adapter that translates lifecycle events into facts and applies activation, shared exhaustion, logging, notification, and continuation outcomes in order.
- [x] 2.5 Move ranking and transition helpers behind the account-selection implementation, then remove obsolete exports and helper-focused tests once equivalent interface coverage passes.

## 3. Make persistence instance-owned

- [x] 3.1 Refactor snapshot persistence and locking to close over explicit instance paths instead of `resetSnapshotStore` and module-level path overrides.
- [x] 3.2 Refactor refresh lease operations to close over an explicit lease path instead of `setLeaseDirectory` and its module-level override.
- [x] 3.3 Refactor snapshot watching to use paths owned by the quota-refresh instance and preserve revision validation and convergence behavior.
- [x] 3.4 Pass the Codex and OpenCode adapters as instance dependencies at the existing provider seam and remove registry-reset requirements from tests.
- [x] 3.5 Convert persistence, lease, watcher, adapter, and concurrency tests to isolated instance construction using temporary directories.

## 4. Deepen quota refresh

- [x] 4.1 Implement the quota-refresh module interface for startup, snapshot subscription/publication, reading, active-source status projection, shared exhaustion recording, and shutdown.
- [x] 4.2 Move refresh freshness scheduling, source concurrency, retry, lease ownership, reconciliation, incremental mutation, and expiry behind the quota-refresh implementation.
- [x] 4.3 Move snapshot watcher lifecycle, refresh timers, active requests, status callbacks, and cleanup behind the quota-refresh implementation.
- [x] 4.4 Replace `QuotaLifecycle` and direct coordinator use in the Pi adapter with the quota-refresh interface while preserving non-blocking session startup and `/quota` reads.
- [x] 4.5 Remove coordinator reach-through, overlapping lifecycle exports, global reset hooks, and superseded tests after all replacement interface tests pass.

## 5. Verify preserved behavior

- [x] 5.1 Run focused quota tests and fix every regression against `shared-quota-snapshot`, `opencode-account-rotation`, `quota-rotation-guard`, `quota-status`, and `quota-command`.
- [x] 5.2 Run `npm run test`, `npm run lint`, and `npm run typecheck`.
- [x] 5.3 Run Prettier in check mode and format affected files where required.
- [x] 5.4 Run `npm run openspec` and resolve every validation failure caused by the change.
