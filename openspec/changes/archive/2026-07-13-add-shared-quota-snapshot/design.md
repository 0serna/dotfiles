## Context

The quota extension currently has three partially coupled responsibilities: fetching Codex and OpenCode data, selecting and rotating OpenCode accounts, and rendering `/quota`. Session startup fetches every OpenCode account synchronously for selection, `/quota` performs a separate fresh fetch, and the custom footer reserves a `quota` status that is no longer published. A previous per-process three-minute poller was removed because it duplicated requests, retained relative reset durations incorrectly, and mixed cache, fetch, and UI concerns.

Concurrent Pi processes load separate extension runtimes, but they use the same user credentials and provider accounts. The shared data is quota observation state; active runtime API keys, account cooldowns, and continuation behavior remain local because they affect an individual agent run.

## Goals / Non-Goals

**Goals:**

- Maintain one versioned, user-scoped snapshot of every declared quota source.
- Keep observations within a five-minute freshness target while at least one Pi runtime is active.
- Coalesce refresh work across processes and publish source results without waiting for slower sources.
- Make status and `/quota` projections consume the same snapshot.
- Preserve last-known observations through transient failures without presenting data older than 30 minutes as usable.
- Let provider-specific adapters own discovery, fetching, normalization, usability, and display projections while keeping orchestration provider-neutral.
- Preserve safe OpenCode rotation semantics and avoid changing runtime credentials during active agent work.

**Non-Goals:**

- Running a daemon or refreshing quota while no Pi process is active.
- Sharing active accounts, runtime API keys, cooldowns, or queued continuations between processes.
- Defining a public plugin API for third-party quota adapters.
- Solving footer overflow for an arbitrary number of future providers.
- Keeping a history of snapshots or provider responses.

## Decisions

### Use a provider-adapter registry behind one snapshot coordinator

`index.ts` will retain lifecycle registration and orchestration. A focused snapshot coordinator will expose three operations to the extension runtime: read the latest snapshot, request an ensure-fresh refresh, and subscribe to snapshot revisions. Provider adapters will declare stable sources and implement one fetch attempt for each source. The registry initially contains Codex and OpenCode Go; adding another provider changes the registry, not the coordinator.

Each source descriptor contains a stable provider/source id, display metadata, a non-secret configuration fingerprint, and provider-specific fetch input held only in memory. Credentials, cookies, access tokens, and raw response bodies are never serialized.

Alternatives rejected:

- Generic JSON endpoints and parsers cannot represent Codex OAuth JSON and OpenCode dashboard HTML safely.
- An inter-extension plugin API adds lifecycle and compatibility concerns without a current external consumer.

### Persist a versioned snapshot and coordinate through the user state directory

The snapshot will live below `XDG_STATE_HOME/pi/quota/`, falling back to `~/.local/state/pi/quota/`. Snapshot writes use a temporary file plus atomic rename and private file permissions. A short snapshot-mutation lock protects read-modify-write transactions so a source publication, runtime exhaustion signal, or configuration reconciliation cannot overwrite an unrelated concurrent update.

A separate expiring refresh lease elects one process to perform due network work. Contenders that lose the lease keep consuming snapshot revisions instead of fetching. Lease records include a refresh id and expiry so a crashed owner can be replaced. The owner releases the lease in `finally`; `session_shutdown` aborts owned requests and removes local timers/watchers.

Each process watches the state directory, debounces changes, validates the schema and monotonically increasing revision, then republishes local status and reevaluates local account eligibility. Periodic rereads remain a fallback because filesystem watch events are advisory.

A dedicated daemon was rejected because its installation and lifecycle cost exceed the needs of a local extension. Per-process snapshots were rejected because they multiply authenticated requests by the number of open Pi processes.

### Model source observations independently inside the aggregate

The persisted snapshot contains cycle metadata and a map of source records. A source record distinguishes:

- initial `refreshing` with no observation;
- fresh observation;
- degraded observation whose latest attempt failed but whose last success is at most 30 minutes old;
- expired observation older than 30 minutes;
- unavailable declaration caused by missing configuration/authentication;
- provider-confirmed exhaustion evidence;
- provider-specific partial issues, such as unavailable Codex banked-reset data.

Each successful source fetch is committed immediately instead of waiting for the whole cycle. Failures preserve the previous observation and update attempt/error metadata. After 30 minutes from the last success, consumers stop treating the observation as usable. Error summaries are structured and bounded; detailed secrets and response bodies remain only in redacted logs.

OpenCode `resetInSec` values are normalized to absolute reset timestamps at observation time. This prevents a persisted relative duration from sliding forward on every render. Codex banked reset failure is a partial issue: fresh usage can still be published, compact status uses `R?`, and the whole source is not marked degraded solely for that endpoint.

### Centralize scheduling and retry policy

A session start reads and publishes the snapshot immediately. If the latest completed refresh is less than five minutes old, it does not perform network work. Otherwise it asynchronously requests an ensure-fresh cycle without delaying session startup. Active runtimes schedule the next due cycle from shared refresh metadata; simultaneous timers race only for the refresh lease.

The coordinator starts all fetchable sources concurrently. It owns a fixed policy of two total attempts per source; adapters perform a single abort-aware attempt and do not retry internally. Results are published source by source. Missing credentials produce an unavailable record without a network attempt.

`/quota` never requests refresh and never waits for an in-flight cycle. It renders the exact partial snapshot available at invocation time.

### Keep shared observations separate from local account operation

OpenCode selection reads all non-expired observations, and degraded observations compete equally with fresh observations until their 30-minute expiry. Session start never waits for quota fetches. It selects from the existing snapshot or activates the existing blind fallback when no usable candidate exists. If the first usable snapshot later identifies a better account, or a periodic observation shows the active account has become unusable, the runtime queues preventive reselection and applies it only after Pi is fully settled and idle.

Reactive `GoUsageLimitError` rotation keeps its current local cooldown and continuation flow. It additionally writes provider-confirmed exhaustion evidence for the affected source into the shared snapshot. Other processes exclude that source, but do not inherit the reporting process's cooldown or active-account choice. The next positive dashboard observation clears the shared exhaustion evidence. A runtime quota error does not trigger an immediate dashboard refresh; reconciliation waits for the normal five-minute cycle.

### Derive both UI projections from snapshot state

The compact publisher uses `ctx.ui.setStatus("quota", ...)` best-effort and shows one local active source per provider:

- `Codex 80% R2 │ OpenCode(2) 75%` for healthy data;
- rolling remaining percentage unless any source window is exhausted, which displays `0%`;
- `R0` for a confirmed empty banked-reset set and `R?` when that component is unavailable;
- a warning-styled `!` after retained degraded data;
- `Provider …` while that provider has no observation and is refreshing;
- `Quota …` when no provider has a usable observation during the runtime's initial refresh;
- `Provider error` when no usable observation remains.

The footer omits reset times and spendable balances. `/quota` remains the detailed projection: every declared source, active marker, all available windows and balances, current state, observation age, and summarized error/configuration reason.

### Treat configuration identity as non-secret shared metadata

The coordinator computes source identity from stable, non-secret provider/account attributes and hashes sensitive identifiers when needed. A source whose identity changes does not inherit the previous observation, and removed declarations are removed from the snapshot. Concurrent runtimes are expected to resolve homogeneous source configuration. A differing runtime records a configuration conflict and does not overwrite a valid shared observation with locally missing credentials.

## Risks / Trade-offs

- **Filesystem leases are weaker than a daemon-backed mutex** → Use expiring leases, atomic writes, revision checks, and idempotent refresh publication.
- **A crashed process may leave a lease until expiry** → Bound lease duration above the two-attempt timeout budget and allow stale-lease takeover.
- **Filesystem watch events may be lost or coalesced** → Debounce reads and retain periodic snapshot rereads as a convergence path.
- **OpenCode dashboard data can lag provider enforcement** → Share explicit runtime exhaustion evidence; accept that the next positive dashboard observation may re-enable the source prematurely and let a new provider error reconfirm it.
- **A degraded 29-minute observation can outrank fresh account data** → This is an accepted consequence of treating degraded observations as usable until the agreed 30-minute boundary.
- **Different process environments can disagree about credentials** → Detect configuration fingerprints, report conflicts in `/quota` and logs, and prevent missing local configuration from replacing valid shared data.
- **Persisted quota and balance data is user-sensitive** → Store only normalized observations under the private user state directory with restrictive permissions; never persist credentials or raw responses.
- **No active Pi process means no refresh** → Expire old observations and perform an asynchronous refresh on the next session start.

## Migration Plan

1. Introduce the versioned snapshot schema, private atomic store, lease coordinator, and adapter interface without changing UI behavior.
2. Adapt Codex and OpenCode fetchers to emit normalized source observations, including absolute OpenCode reset timestamps.
3. Switch session startup selection to snapshot consumption and enable the asynchronous shared refresh lifecycle.
4. Switch `/quota` to the read-only detailed projection and publish compact `quota` footer status.
5. Add shared runtime exhaustion evidence and idle-only preventive reselection.
6. Ignore any legacy `/tmp/pi-quota-cache.json`; it lacks source identities and valid absolute OpenCode reset timestamps.

Rollback removes the new status publisher and state-directory artifacts and restores direct startup/command fetching. The snapshot is versioned and can be safely ignored by older code.

## Open Questions

None. Footer overflow for additional providers is intentionally deferred until it becomes an observed problem.
