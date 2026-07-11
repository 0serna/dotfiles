# pi-agent-duration-footer Specification

## Purpose

Publish live agent elapsed time as part of the working message via `setWorkingMessage`, alongside assistant token throughput. This spec replaces the standalone duration footer extension; duration is now composed into the unified working-stats message.

## Requirements

### Requirement: Duration extension publishes live agent elapsed time

The Pi working-stats extension SHALL publish the agent elapsed time as part of the working message via `setWorkingMessage`, alongside assistant token throughput.

#### Scenario: Agent run starts

- **WHEN** Pi emits `agent_start`
- **THEN** the extension records the run start time
- **AND** publishes a working message formatted as `Working 0s · - tok/s`

#### Scenario: Active run updates once per second

- **WHEN** an agent run is active
- **THEN** the extension updates the working message at approximately one-second intervals
- **AND** the displayed elapsed time is calculated from the recorded `agent_start` time
- **AND** the working message includes the current throughput display when available

#### Scenario: Active run completes

- **WHEN** Pi emits `agent_end` for an active run
- **THEN** the extension stops the live update interval
- **AND** notifies the total elapsed time via `ctx.ui.notify` formatted as `Completed in Xm Ys`
- **AND** appends the last final throughput (e.g. ` · 48 tok/s`) when available
- **AND** clears the working message

### Requirement: Duration extension manages lifecycle cleanup

The Pi working-stats extension SHALL clean up runtime resources when agent runs finish or sessions shut down.

#### Scenario: Session shuts down during active timing

- **WHEN** Pi emits `session_shutdown` while a live update interval exists
- **THEN** the extension clears the interval
- **AND** resets all throughput and timing state
- **AND** clears the working message
