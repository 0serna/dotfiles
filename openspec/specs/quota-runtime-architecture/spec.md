# quota-runtime-architecture Specification

## Purpose

TBD - created by archiving change deepen-quota-runtime. Update Purpose after archive.

## Requirements

### Requirement: Account selection has one runtime-local owner

The quota extension SHALL place OpenCode account activation state, cooldowns, blind fallback, processing-cycle attempts, continuation gating, reactive rotation, and preventive reselection behind one account-selection module interface. Shared quota observations SHALL remain inputs to this module and SHALL NOT make its runtime-local state global. The selection algorithm SHALL rank eligible accounts by quota urgency rate as defined in the quota-urgency-scoring specification.

#### Scenario: Snapshot revision changes account eligibility

- **WHEN** the account-selection module receives a snapshot revision that changes the active account's eligibility
- **THEN** the module determines whether reselection is required using its owned runtime-local state
- **AND** the caller does not coordinate ranking, blind fallback, or pending reselection separately

#### Scenario: Processing cycle exhausts configured accounts

- **WHEN** provider-confirmed quota errors attempt every configured account during one processing cycle
- **THEN** the account-selection module records the attempted accounts and produces the stop outcome
- **AND** a later settled processing cycle clears that runtime-local attempt state

### Requirement: Pi registration is an account-selection adapter

The quota extension entry module SHALL translate Pi lifecycle observations into account-selection facts and SHALL apply account-selection outcomes through Pi auth storage, UI, logging, shared exhaustion recording, and automatic-continuation facilities. It SHALL NOT independently retain account-selection policy state.

#### Scenario: Quota error triggers rotation outcomes

- **WHEN** Pi reports an eligible OpenCode quota-exhaustion error
- **THEN** the entry adapter passes a normalized fact to the account-selection module
- **AND** applies the returned account activation, shared exhaustion, notification, logging, and continuation outcomes in their required order

#### Scenario: Non-domain Pi event data is available

- **WHEN** the adapter receives a Pi callback containing context unrelated to account selection
- **THEN** it passes only the normalized domain facts required by the account-selection interface
- **AND** the account-selection module does not depend on `ExtensionAPI` or `ExtensionContext`

### Requirement: Quota refresh has one lifecycle owner

The quota extension SHALL place refresh scheduling, source concurrency and retry, refresh leasing, snapshot locking and persistence, snapshot watching, revision publication, status projection, exhaustion recording, and shutdown behind one quota-refresh module interface. Callers SHALL NOT reach through that interface to a separate coordinator.

#### Scenario: Runtime starts with stale shared quota

- **WHEN** the quota-refresh module starts and the latest completed shared refresh is stale or missing
- **THEN** the module publishes available snapshot state, requests refresh asynchronously, coordinates the lease, and publishes source revisions
- **AND** the caller does not separately schedule, fetch, persist, watch, or publish the refresh

#### Scenario: Runtime shuts down during refresh

- **WHEN** quota-refresh shutdown occurs while timers, watchers, subscribers, or source requests are active
- **THEN** the quota-refresh module cancels or closes every resource it owns
- **AND** no refresh resource remains active after shutdown completes

### Requirement: Quota persistence configuration is instance-owned

Each quota-refresh module instance SHALL own its resolved snapshot, lock, lease, and watcher paths. Snapshot and lease modules SHALL NOT use process-global mutable path configuration.

#### Scenario: Independent refresh instances coexist

- **WHEN** two quota-refresh instances are constructed in one process with different state directories
- **THEN** each instance reads, writes, locks, leases, and watches only its configured paths
- **AND** constructing or using one instance does not alter the other instance's persistence behavior

#### Scenario: Tests use temporary state directories

- **WHEN** a test constructs a quota-refresh module with a temporary state directory
- **THEN** the same filesystem implementation used in production operates within that directory
- **AND** the test does not call a process-global reset hook

### Requirement: Deep module interfaces are the quota test surface

Account-selection policy and quota-refresh lifecycle behavior SHALL be testable through their respective module interfaces. Tests SHALL NOT require coordinator reach-through, process-global registry resets, or reconstruction of policy across shallow helper interfaces.

#### Scenario: Account-selection regression is tested

- **WHEN** a regression concerns blind fallback, rotation, processing-cycle attempts, cooldowns, or preventive reselection
- **THEN** the regression test drives the account-selection interface with normalized facts
- **AND** asserts outcomes without constructing a full Pi context mock

#### Scenario: Refresh regression is tested

- **WHEN** a regression concerns scheduling, lease contention, source publication, persistence, watching, or shutdown
- **THEN** the regression test drives the quota-refresh interface using an isolated instance
- **AND** does not access an internal coordinator
