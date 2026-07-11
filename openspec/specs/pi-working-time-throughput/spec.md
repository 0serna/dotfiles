# pi-working-time-throughput Specification

## Purpose

Unified extension that composes agent elapsed time and assistant token throughput into a single working message. Replaces the separate duration and tps extensions.

## Requirements

### Requirement: Working message shows elapsed agent time

The working-time extension SHALL publish a working message via `setWorkingMessage` that displays the elapsed wall-clock time since `agent_start`.

#### Scenario: Agent run starts

- **WHEN** Pi emits `agent_start`
- **THEN** the extension records the run start time
- **AND** publishes a working message formatted as `Working 0s · - tok/s`

#### Scenario: Active run updates once per second

- **WHEN** an agent run is active
- **THEN** the extension updates the working message at approximately one-second intervals
- **AND** the elapsed time is calculated from the recorded `agent_start` time

#### Scenario: Active run completes

- **WHEN** Pi emits `agent_end` for an active run
- **THEN** the extension stops the live update interval
- **AND** notifies the total elapsed time via `ctx.ui.notify` formatted as `Completed in Xm Ys`
- **AND** appends the last final throughput (e.g. ` · 48 tok/s`) when available
- **AND** clears the working message

### Requirement: Working message shows assistant token throughput

The working-time extension SHALL include assistant output throughput in the working message only while an assistant stream is actively producing output deltas.

#### Scenario: Placeholder before first stream

- **WHEN** no assistant stream has occurred in this agent run
- **THEN** the working message displays `- tok/s` as the throughput portion

#### Scenario: Live throughput during generation

- **WHEN** an assistant stream has produced output deltas and the next interval tick occurs
- **THEN** the working message displays an estimated throughput formatted as `N tok/s`
- **AND** the value is calculated as estimated output tokens divided by elapsed seconds since the first output delta

#### Scenario: Placeholder after stream ends

- **WHEN** an assistant stream ends (tools execute or agent waits for a new stream)
- **THEN** the working message reverts to the `- tok/s` placeholder

### Requirement: Final throughput is stored for the completion notification

The working-time extension SHALL store the last final throughput internally and surface it in the `agent_end` notification only.

#### Scenario: Final throughput recorded on stream end with usage

- **WHEN** an assistant stream ends with provider usage containing an output token count
- **THEN** the extension stores the final throughput calculated from provider-reported output tokens

#### Scenario: Last final preserved when usage is unavailable

- **WHEN** an assistant stream ends without provider output usage
- **THEN** the extension preserves the previously stored final throughput value

#### Scenario: Completion notification includes final throughput

- **WHEN** Pi emits `agent_end` and a final throughput has been stored
- **THEN** the completion notification includes the value formatted as `Completed in Xm Ys · N tok/s`

### Requirement: Throughput measurement is scoped to one assistant stream

The working-time extension SHALL measure each assistant stream independently.

#### Scenario: New assistant stream resets measurement

- **WHEN** a new assistant stream begins after a previous stream ended
- **THEN** the live measurement for the new stream starts from that stream's first output delta

#### Scenario: Agent latency is excluded from throughput

- **WHEN** there is a delay between the user prompt and the first assistant output delta
- **THEN** that delay is excluded from throughput calculations

### Requirement: Extension cleans up runtime resources

The working-time extension SHALL clean up runtime resources on agent end and session shutdown.

#### Scenario: Interval stops on agent end

- **WHEN** Pi emits `agent_end`
- **THEN** the extension clears the live update interval
- **AND** does not continue publishing updates after the agent ends

#### Scenario: Session shutdown clears all state

- **WHEN** Pi emits `session_shutdown`
- **THEN** the extension clears any active interval
- **AND** resets all throughput and timing state
- **AND** clears the working message
