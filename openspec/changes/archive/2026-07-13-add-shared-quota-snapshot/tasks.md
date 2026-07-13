## 1. Snapshot Domain and Provider Adapters

- [x] 1.1 Add failing tests and define the versioned aggregated snapshot, source identity, lifecycle state, freshness, degradation, expiry, partial-issue, and provider-exhaustion types.
- [x] 1.2 Add failing tests and implement pure snapshot transition helpers for incremental success/failure publication, 30-minute expiry, configuration reconciliation, and positive-observation exhaustion clearing.
- [x] 1.3 Define the internal quota adapter/source descriptor contract and registry, then register Codex and OpenCode Go sources without persisting fetch credentials.
- [x] 1.4 Refactor Codex fetching into one abort-aware adapter attempt that preserves successful usage when banked-reset fetching fails and distinguishes known `R0` from unavailable `R?`.
- [x] 1.5 Refactor OpenCode fetching into one abort-aware adapter attempt and normalize every `resetInSec` value to an absolute reset timestamp at observation time.

## 2. Shared Persistence and Cross-Process Coordination

- [x] 2.1 Add failing filesystem tests and implement the private XDG quota state directory, versioned snapshot validation, atomic writes, monotonic revisions, and corrupt-snapshot recovery.
- [x] 2.2 Add failing concurrency tests and implement a bounded snapshot mutation lock that preserves unrelated concurrent source updates.
- [x] 2.3 Add failing lease tests and implement refresh-owner acquisition, contention, release, expiry, and crashed-owner takeover across processes.
- [x] 2.4 Implement directory watching with debounced validated reloads, revision filtering, subscriber notification, and periodic reread fallback.
- [x] 2.5 Implement non-secret configuration fingerprints, source removal/identity invalidation, and conflict reporting that cannot overwrite a valid observation with missing local configuration.

## 3. Central Refresh Lifecycle

- [x] 3.1 Add failing coordinator tests and implement concurrent source refresh with exactly two total attempts per source and incremental publication as each source resolves.
- [x] 3.2 Implement five-minute ensure-fresh scheduling from shared refresh metadata, including recent-snapshot reuse, overdue refresh, and cross-process coalescing.
- [x] 3.3 Integrate asynchronous snapshot loading, subscription, refresh scheduling, abort handling, watcher/timer cleanup, and status clearing into `session_start` and `session_shutdown`.
- [x] 3.4 Add structured quota logs for lease ownership, refresh cycles, source attempts/results, degradation/expiry, configuration conflicts, and snapshot publication without logging secrets.

## 4. Compact Status and Detailed Command

- [x] 4.1 Add failing formatter tests for `Codex 80% R2 │ OpenCode(2) 75%`, rolling selection, any-window `0%`, permanent `R<n>`/`R?`, and omitted reset times and spendable balances.
- [x] 4.2 Add failing lifecycle formatter tests for `Quota …`, per-provider loading, warning-styled degraded `!`, and generic `Provider error` output.
- [x] 4.3 Implement best-effort publication through the single `quota` status key and update status on snapshot revisions and local active-source changes without periodic notifications.
- [x] 4.4 Add failing `/quota` tests and change the command to render the immediately available snapshot without fetching or waiting, including every source's active marker, values, state, age, and summarized reason.
- [x] 4.5 Remove obsolete command-loading and direct-fetch orchestration that is superseded by the shared snapshot while retaining full-detail provider formatting.

## 5. Snapshot-Driven OpenCode Selection

- [x] 5.1 Add failing selection tests so fresh and degraded observations compete equally, while expired, unavailable, exhausted, and provider-confirmed exhausted sources are rejected.
- [x] 5.2 Replace blocking startup quota selection with immediate shared-snapshot selection and blind fallback when no usable observation exists.
- [x] 5.3 Add failing lifecycle tests and implement one-time blind-fallback reevaluation plus preventive reselection only when the active source becomes unusable and Pi is fully settled.
- [x] 5.4 Add failing shared-state tests and publish `GoUsageLimitError` as provider-confirmed exhaustion without sharing local cooldown, attempted-account, active-key, or continuation state.
- [x] 5.5 Reconcile provider-confirmed exhaustion on the next positive dashboard observation without triggering an immediate refresh.

## 6. Verification

- [x] 6.1 Run focused quota tests throughout the red-green-refactor loop and remove or update tests tied to direct `/quota` fetching and blocking startup behavior.
- [x] 6.2 Run Prettier validation, ESLint, TypeScript type checking, the full Vitest suite, and strict OpenSpec validation; fix every reported issue without suppressions.
