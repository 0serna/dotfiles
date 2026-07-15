## Context

The quota extension has two connected architectural seams. Runtime-local OpenCode account selection consumes shared quota snapshot revisions, while quota refresh produces and persists those revisions. Today account-selection state is held in `index.ts` across many mutable fields and coordinated through shallow helpers; refresh behavior is split between `lifecycle.ts` and `coordinator.ts`, with persistence paths configured through process-global mutable overrides in `snapshot-store.ts` and `refresh-lease.ts`.

This shape reduces locality. Account-selection tests must reconstruct Pi callback ordering to verify policy, and refresh tests must reset hidden global configuration before creating a coordinator. The existing user-visible contracts and ADR-0002 remain correct: quota observations are shared per user, while active accounts, runtime API keys, cooldowns, attempted accounts, and continuation state remain local to each Pi runtime.

## Goals / Non-Goals

**Goals:**

- Create one deep account-selection module whose interface expresses domain facts and outcomes rather than Pi callback shapes.
- Put every runtime-local account-selection invariant in that module.
- Keep `index.ts` as a thin Pi adapter that translates events and executes outcomes.
- Create one deep quota-refresh module that owns scheduling, fetching, leasing, snapshot mutation, persistence, watching, publication, and shutdown.
- Make all quota-refresh filesystem paths instance-owned and remove process-global configuration.
- Make each deep module’s interface the primary test surface.
- Preserve all existing quota behavior and persisted snapshot data.

**Non-Goals:**

- Changing account ranking, cooldown duration, rotation guards, or automatic-continuation policy.
- Changing shared snapshot schema, freshness, retry, retention, or lease semantics.
- Changing compact quota status or `/quota` output.
- Adding a public quota adapter interface for external extensions.
- Merging shared observations with runtime-local account operation.
- Adding new Pi event listeners or changing their ordering.

## Decisions

### 1. Model account selection as one stateful transition module

Create an account-selection module that owns configured account states, the active account identity, cooldowns, blind-fallback state, attempted accounts for the current processing cycle, pending preventive reselection, the latest snapshot, and continuation gating.

Its small interface consumes a normalized account-selection fact and returns explicit outcomes. Facts represent domain observations such as startup with a snapshot, a new snapshot revision, provider-confirmed quota exhaustion, processing-cycle settlement, and shutdown. Outcomes represent work the Pi adapter must apply, such as activating an account, recording shared exhaustion, requesting continuation, logging a decision, or notifying the user.

The implementation may compose pure ranking and transition functions internally, but those functions are internal seams rather than separate caller-facing modules. The deletion test then succeeds: deleting the account-selection module would redistribute its invariants and mutable state back across Pi callbacks.

A class with one method per Pi hook was rejected because that interface would remain nearly as complex as the adapter and would preserve callback ordering as caller knowledge. Keeping the current collection of pure helpers was rejected because the bugs occur in their orchestration, not in the isolated calculations.

### 2. Keep Pi effects in the adapter

`index.ts` remains the adapter for Pi’s extension interface. It loads account configuration, builds normalized source declarations, registers hooks and `/quota`, translates relevant Pi events into account-selection facts, and applies returned outcomes through auth storage, quota refresh, logging, UI, and the `auto-continue:request` event.

The account-selection module does not import `ExtensionAPI` or `ExtensionContext`. Time is supplied with facts or through an accepted clock dependency so cooldown and settlement behavior remain deterministic in tests. The adapter retains Pi-specific checks such as current provider and `ctx.isIdle()`.

Injecting the complete Pi context into the module was rejected because it would leak Pi’s interface across the seam and make domain tests depend on a large mock.

### 3. Replace lifecycle plus coordinator with one quota-refresh module

Create one quota-refresh module that owns the complete lifetime of shared quota observations. Its external interface covers starting with declared sources and a snapshot subscriber, reading the current snapshot, recording provider-confirmed exhaustion, updating the local active source used for status projection, and shutdown. Refresh coordination remains behind that interface; callers cannot reach through to a coordinator.

The implementation absorbs the current lifecycle scheduler and coordinator. Source concurrency, retries, lease acquisition, snapshot reconciliation, publication, status projection, and watcher convergence become internal implementation details with locality in one module.

Retaining both `QuotaLifecycle` and `Coordinator` was rejected because their overlapping `read`, subscription, and shutdown behavior creates two interfaces for one responsibility. Adding a new facade while preserving both was rejected by the deletion test: it would add another shallow module without concentrating complexity.

### 4. Make persistence mechanics instance-owned internal modules

Snapshot and lease operations receive resolved paths from the quota-refresh instance. Remove `resetSnapshotStore` and `setLeaseDirectory`, along with module-level path overrides. Snapshot locking, atomic writing, lease acquisition, and watcher creation remain focused internal modules, but their configuration is closed over by the owning quota-refresh instance.

No filesystem adapter seam is introduced. Production and tests use the same filesystem implementation with different instance paths; one adapter would only create a hypothetical seam. Tests use temporary directories through quota-refresh construction.

This allows multiple quota-refresh instances to coexist safely in one process, which matches test execution and avoids hidden cross-instance coupling.

### 5. Keep provider adapters as the existing real seam

Codex and OpenCode Go are two concrete adapters at the provider seam, so the seam remains justified. The quota-refresh module receives the adapter registry or adapter collection as an instance dependency instead of relying on registry resets for test isolation. Credentials and source declarations remain in memory and no provider-specific branching moves into refresh orchestration.

Changing provider observation normalization is out of scope. This decision only changes ownership and construction.

### 6. Replace helper-focused tests with interface-focused tests

Account-selection tests drive normalized facts through the module interface and assert outcomes and retained state only where state is part of an observable decision. Focused Pi adapter tests verify event translation and outcome application; they do not reproduce the full account policy.

Quota-refresh tests construct independent instances in temporary directories and verify refresh, publication, lease contention, persistence, watching, exhaustion recording, and shutdown through the external interface. Internal persistence mechanics keep focused tests only for corruption, permissions, atomic writes, and lock/lease edge cases that cannot be observed reliably at the external seam.

Existing behavior tests remain as regression evidence until equivalent interface coverage exists, then shallow-helper and coordinator reach-through tests are deleted rather than duplicated.

## Risks / Trade-offs

- **[Large refactor can alter quota behavior]** → Preserve existing specs as characterization tests and move one seam at a time before deleting old modules.
- **[Outcome application can partially fail]** → Keep outcomes ordered, make best-effort UI/log effects non-blocking, and apply account activation before continuation requests as today.
- **[A single refresh module can become large]** → Keep persistence, lease, watcher, provider adapters, and snapshot transitions as internal focused modules; depth concerns the external interface, not one file.
- **[Pure facts can expose too much implementation state]** → Normalize only domain observations required for decisions and keep Pi event payloads out of the interface.
- **[Removing globals can reveal tests that depended on reset order]** → Convert tests to instance construction before deleting reset hooks.
- **[Combining lifecycle and coordinator may obscure low-level failures]** → Preserve structured logging and focused internal tests for lock, lease, and atomic persistence failures.

## Migration Plan

1. Add characterization coverage for the current account-selection and refresh behavior that is not already protected by living specs.
2. Introduce the account-selection transition module and route existing Pi events through it while retaining current helper implementations internally.
3. Move activation, rotation, blind fallback, cycle attempts, and preventive reselection state out of `index.ts`; delete obsolete shallow helpers after equivalent interface tests pass.
4. Parameterize snapshot, lock, lease, and watcher operations with instance paths; convert tests away from global resets.
5. Introduce the unified quota-refresh module, move scheduler/coordinator behavior behind it, and remove coordinator reach-through.
6. Delete the overlapping lifecycle interface and process-global configuration hooks.
7. Run focused quota tests, the repository quality gate, and full OpenSpec validation.

No persisted-state migration is required. Rollback can restore the previous module wiring while continuing to read the unchanged snapshot schema.

## Open Questions

None.
