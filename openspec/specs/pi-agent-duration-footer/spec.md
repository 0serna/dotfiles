# pi-agent-duration-footer Specification

## Purpose

TBD - created by archiving change add-pi-duration-extension. Update Purpose after archive.

## Requirements

### Requirement: Duration extension publishes live agent elapsed time

The Pi duration extension SHALL publish a compact footer status for an active agent run using the `duration` status key.

#### Scenario: Agent run starts

- **WHEN** Pi emits `agent_start`
- **THEN** the extension records the run start time
- **AND** publishes a status formatted as `⏱ <duration>`

#### Scenario: Active run updates once per second

- **WHEN** an agent run is active
- **THEN** the extension updates the `duration` status at approximately one-second intervals
- **AND** the displayed elapsed time is calculated from the recorded `agent_start` time

#### Scenario: Active run completes

- **WHEN** Pi emits `agent_end` for an active run
- **THEN** the extension stops the live update interval
- **AND** leaves the completed run duration visible using the same `⏱ <duration>` format

### Requirement: Duration extension infers last duration from session history

The Pi duration extension SHALL infer the latest completed agent duration from persisted session message timestamps when a session starts and no active run is in progress.

#### Scenario: Session contains a completed user message block

- **WHEN** session history contains a user message followed by one or more generated messages before the next user message
- **THEN** the extension infers the duration from the user message timestamp to the last generated message timestamp in that block
- **AND** publishes the inferred duration formatted as `⏱ <duration>`

#### Scenario: Session has no inferable completed block

- **WHEN** session history does not contain a user message followed by a generated message
- **THEN** the extension does not invent a duration value
- **AND** does not publish a misleading completed duration

### Requirement: Duration extension manages lifecycle cleanup

The Pi duration extension SHALL clean up runtime resources when agent runs finish or sessions shut down.

#### Scenario: Session shuts down during active timing

- **WHEN** Pi emits `session_shutdown` while a live update interval exists
- **THEN** the extension clears the interval
- **AND** does not continue publishing live elapsed updates for the old session

#### Scenario: New session starts after a prior measured run

- **WHEN** Pi emits `session_start` for a session with an inferable completed duration
- **THEN** the extension publishes that session's inferred duration using the same compact status format
- **AND** the previous session's live timing state is not reused
