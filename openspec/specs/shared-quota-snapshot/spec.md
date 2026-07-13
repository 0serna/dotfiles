# shared-quota-snapshot Specification

## Purpose

TBD - created by archiving change add-shared-quota-snapshot. Update Purpose after archive.

## Requirements

### Requirement: Provider adapters declare quota sources

The quota extension SHALL use an internal provider-adapter registry to discover every declared quota source and fetch provider-specific observations without embedding provider branching in the snapshot coordinator.

#### Scenario: Registered adapters discover sources

- **WHEN** a quota refresh begins
- **THEN** the coordinator asks every registered adapter for its declared sources
- **AND** the resulting source set includes the Codex login and each declared OpenCode Go account

#### Scenario: Declared source lacks credentials

- **WHEN** an adapter declares a source whose required authentication or configuration is absent
- **THEN** the snapshot includes that source as unavailable with a summarized reason
- **AND** the coordinator does not issue a network request for that source

#### Scenario: Future adapter is registered

- **WHEN** a new provider adapter is added to the internal registry
- **THEN** its declared sources participate in the same refresh, persistence, and subscription flow without changing coordinator behavior

### Requirement: Aggregated snapshot is shared per user

The system SHALL maintain one versioned aggregated quota snapshot in the private user state directory and SHALL share it across concurrent Pi processes without persisting credentials or raw provider responses.

#### Scenario: Concurrent processes read quota

- **WHEN** two Pi processes use the quota extension concurrently
- **THEN** both read source observations from the same user-scoped snapshot
- **AND** their active accounts, runtime API keys, and cooldowns remain process-local

#### Scenario: Snapshot is written

- **WHEN** snapshot state changes
- **THEN** the system writes it atomically under `XDG_STATE_HOME/pi` or the equivalent `~/.local/state/pi` fallback
- **AND** the persisted file uses private user permissions
- **AND** no access token, API key, cookie, or raw response body is persisted

#### Scenario: Snapshot schema is unsupported or corrupt

- **WHEN** a process cannot validate the persisted snapshot
- **THEN** it ignores the invalid data and requests a new refresh
- **AND** it does not expose partial unvalidated values as usable quota

### Requirement: Refresh requests are coalesced across processes

The system SHALL elect at most one active refresh owner across Pi processes and SHALL let all other processes consume the owner's published revisions instead of duplicating provider requests.

#### Scenario: Periodic refresh races across processes

- **WHEN** multiple Pi processes request a due refresh concurrently
- **THEN** one process acquires the refresh lease
- **AND** the other processes do not fetch the same source set

#### Scenario: Refresh owner terminates

- **WHEN** the refresh owner exits or fails before releasing its lease
- **THEN** another process can take over after the bounded lease expires
- **AND** an abandoned lease cannot suppress refresh indefinitely

#### Scenario: Shared snapshot changes

- **WHEN** one process publishes a new snapshot revision
- **THEN** watching Pi processes reload the revision and update their local status promptly
- **AND** periodic rereading provides a fallback if a filesystem watch event is missed

### Requirement: Refresh schedule targets five-minute freshness

While at least one Pi runtime is active, the system SHALL request a quota refresh when the latest completed shared refresh is at least five minutes old. The system SHALL NOT run a background daemon when no Pi runtime is active.

#### Scenario: Session starts with recent snapshot

- **WHEN** `session_start` reads a completed snapshot less than five minutes old
- **THEN** it reuses that snapshot
- **AND** it does not issue provider requests

#### Scenario: Session starts with stale or missing snapshot

- **WHEN** `session_start` finds no completed snapshot younger than five minutes
- **THEN** it requests the centralized refresh asynchronously
- **AND** session startup does not wait for provider requests to complete

#### Scenario: Laptop or runtime resumes after inactivity

- **WHEN** an active Pi runtime observes that the shared refresh is overdue
- **THEN** it requests a refresh immediately subject to cross-process coalescing

### Requirement: Central refresh owns concurrency and retries

The coordinator SHALL start fetchable quota sources independently, SHALL apply two total attempts per source, and SHALL publish each source result as soon as that source resolves.

#### Scenario: Sources have different latency

- **WHEN** Codex completes before an OpenCode source
- **THEN** the Codex result is committed to the snapshot without waiting for OpenCode
- **AND** the OpenCode result is committed separately when it resolves

#### Scenario: First attempt fails

- **WHEN** a source's first fetch attempt fails
- **THEN** the coordinator performs one retry for that source
- **AND** the provider adapter does not add its own retry loop

#### Scenario: Both attempts fail

- **WHEN** both attempts for a source fail
- **THEN** the coordinator records a bounded summarized failure
- **AND** successful results from other sources remain unaffected

### Requirement: Source failures preserve bounded last-known data

The snapshot SHALL preserve a source's last successful observation after a refresh failure for at most 30 minutes. Such data SHALL be degraded but usable until expiry, after which consumers SHALL treat it as an error.

#### Scenario: Refresh fails with recent observation

- **WHEN** a source refresh fails and its last success is no more than 30 minutes old
- **THEN** the observation remains available and eligible for account selection
- **AND** the source is marked degraded with its latest failure metadata

#### Scenario: Degraded observation reaches expiry

- **WHEN** more than 30 minutes have elapsed since a degraded source's last successful observation
- **THEN** the observation becomes expired
- **AND** it is no longer eligible for status values or account selection

#### Scenario: Source succeeds after degradation

- **WHEN** a later refresh succeeds for a degraded source
- **THEN** the new observation replaces the retained data
- **AND** the degraded failure state is cleared

### Requirement: Provider observations use stable absolute data

Provider adapters SHALL normalize observations for persistence so that rendering a retained snapshot does not alter the meaning of quota values or reset times.

#### Scenario: OpenCode reports relative reset duration

- **WHEN** OpenCode returns `resetInSec`
- **THEN** the adapter stores the corresponding absolute reset timestamp using the observation time
- **AND** subsequent renders do not move the reset forward

#### Scenario: Codex reset endpoint fails independently

- **WHEN** Codex usage succeeds but the dedicated banked-reset endpoint fails after its attempts
- **THEN** fresh Codex usage is published
- **AND** banked reset state is recorded as unavailable rather than as a confirmed zero
- **AND** the source is not degraded solely because the banked-reset component failed

### Requirement: Source identity protects retained observations

Each persisted source SHALL have a stable non-secret identity. Changed or removed source declarations SHALL NOT inherit unrelated observations, and configuration conflicts between concurrent processes SHALL NOT overwrite a valid shared observation.

#### Scenario: Source identity changes

- **WHEN** an account or source configuration resolves to a different source identity
- **THEN** the prior observation is invalidated for that source
- **AND** the new source begins without inherited quota values

#### Scenario: Source declaration is removed

- **WHEN** a source is no longer declared by the homogeneous quota configuration
- **THEN** it is removed from the aggregated snapshot

#### Scenario: One process lacks shared configuration

- **WHEN** a process resolves configuration that conflicts with the shared source identity
- **THEN** the process reports a configuration conflict in quota detail and logs
- **AND** it does not replace a valid shared observation with its locally missing configuration

### Requirement: Runtime exhaustion evidence is shared

An explicit provider quota-exhaustion error SHALL mark the affected source globally ineligible without sharing the reporting runtime's account cooldown or active-account decision.

#### Scenario: OpenCode reports quota exhaustion

- **WHEN** a Pi runtime receives an explicit `GoUsageLimitError` for its active OpenCode account
- **THEN** it records provider-confirmed exhaustion for that shared source
- **AND** other processes exclude the source from account selection
- **AND** each process keeps its own cooldown and rotation state

#### Scenario: Dashboard later reports positive quota

- **WHEN** the next successful dashboard observation reports positive quota for a provider-confirmed exhausted source
- **THEN** the shared exhaustion evidence is cleared

#### Scenario: Runtime exhaustion is recorded

- **WHEN** provider-confirmed exhaustion is written
- **THEN** it does not trigger an immediate dashboard refresh
- **AND** reconciliation waits for the normal periodic cycle
