## MODIFIED Requirements

### Requirement: /quota command displays full detail

The system SHALL register a `/quota` command that immediately renders every declared source from the latest aggregated quota snapshot and indicates the locally active OpenCode Go account.

#### Scenario: Command execution with active account

- **WHEN** the user types `/quota`
- **THEN** the system reads the current shared snapshot without issuing provider requests
- **AND** it displays every available window, credits, balances, and reset details for each source
- **AND** the active OpenCode Go account is identified

#### Scenario: Command runs during refresh

- **WHEN** `/quota` is invoked while a centralized refresh is in progress
- **THEN** it returns immediately with the partial snapshot available at invocation time
- **AND** sources still awaiting their first result are shown as refreshing

### Requirement: Block format

The `/quota` output SHALL use box-drawing provider/source blocks with aligned quota columns and SHALL include source state, observation age, and a summarized failure or configuration reason when applicable.

#### Scenario: Full output with both providers

- **WHEN** Codex and multiple OpenCode sources have observations
- **THEN** output contains a Codex block and one OpenCode block per declared account
- **AND** each block shows its available rolling, weekly, and monthly windows as applicable
- **AND** Codex credits/resets and OpenCode balance remain detailed-view fields

#### Scenario: Codex has zero available reset credits

- **WHEN** Codex usage is available but banked-reset data reports an empty available set
- **THEN** the Codex section shows `Resets 0`

#### Scenario: Codex reset-credits endpoint failed

- **WHEN** Codex banked-reset data is unavailable due to fetch failure
- **THEN** the Codex block omits reset-credit values or marks them unavailable
- **AND** it does not report a fabricated `Resets 0`

#### Scenario: Provider with error

- **WHEN** a source has no usable observation
- **THEN** its block shows its state (e.g. `error`, `expired`, `unavailable`, or `refreshing`)
- **AND** the detailed reason is displayed without credentials, raw response bodies, or stack traces

#### Scenario: Missing windows

- **WHEN** a source has no weekly window
- **THEN** the weekly row is omitted from its block

#### Scenario: Degraded source

- **WHEN** a source retains a recent observation after a failed refresh
- **THEN** its block shows the retained quota values
- **AND** its state is `degraded`
- **AND** its observation age and summarized latest failure are displayed

## ADDED Requirements

### Requirement: /quota is a read-only snapshot projection

The `/quota` command SHALL NOT request, force, join, or wait for a quota refresh.

#### Scenario: Snapshot is younger than five minutes

- **WHEN** `/quota` renders a recent snapshot
- **THEN** no quota source is fetched

#### Scenario: Snapshot is stale or expired

- **WHEN** `/quota` renders stale, degraded, or expired source state
- **THEN** it reports that state and its age
- **AND** it does not initiate network activity

## REMOVED Requirements

### Requirement: Command refreshes data

**Reason**: Provider fetching is centralized in the shared startup/periodic refresh coordinator; command-triggered fetching would duplicate work and violate the read-only snapshot contract.

**Migration**: `/quota` now renders the latest aggregated snapshot immediately. Freshness is supplied by session startup and the five-minute periodic refresh cycle.
