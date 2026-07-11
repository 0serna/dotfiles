## Purpose

Display live and final assistant output throughput in the Pi working message, showing tokens per second for each assistant stream. Throughput is now part of the working message via `setWorkingMessage` rather than a standalone footer status key.

## Requirements

### Requirement: Footer displays assistant output throughput

The Pi working-stats extension SHALL include assistant output throughput in the working message via `setWorkingMessage`, displayed inline alongside the agent elapsed time only during active streaming. After a stream ends the placeholder `- tok/s` is shown.

#### Scenario: Publish live throughput during generation

- **WHEN** an assistant stream has produced output deltas and the interval tick occurs
- **THEN** the working message displays a live estimated throughput formatted as `N tok/s`
- **AND** the value is calculated as estimated output tokens divided by elapsed generation seconds since the first output delta

#### Scenario: Live throughput counts total streamed output

- **WHEN** an assistant stream emits text, thinking, or tool-call deltas
- **THEN** the live estimate includes those deltas in the estimated output token count
- **AND** the estimate is not limited to visible assistant text only

#### Scenario: Placeholder after stream ends

- **WHEN** an assistant stream ends (message_end fires, tools execute, or agent waits for a new stream)
- **THEN** the working message displays the `- tok/s` placeholder

### Requirement: Footer replaces live estimate with precise final throughput

The Pi working-stats extension SHALL store the precise final throughput value internally when an assistant stream closes with provider usage, and surface it only in the `agent_end` completion notification.

#### Scenario: Store final throughput on message end

- **WHEN** an assistant stream ends with provider usage containing an output token count
- **THEN** the extension stores the final throughput internally
- **AND** the value is calculated as provider-reported output tokens divided by elapsed seconds from the first output delta to message end

#### Scenario: Preserve last final when usage is unavailable

- **WHEN** an assistant stream ends without provider output usage
- **THEN** the extension preserves the previously stored final throughput value
- **AND** the extension does not publish the live estimate as a final value

#### Scenario: Completion notification includes final throughput

- **WHEN** Pi emits `agent_end` and a final throughput has been stored
- **THEN** the completion notification includes the value formatted as `Completed in Xm Ys · N tok/s`

### Requirement: Throughput measurement is scoped to one assistant stream

The Pi working-stats extension SHALL measure each assistant stream independently rather than accumulating throughput across a full user prompt or agent run.

#### Scenario: New assistant stream resets live measurement

- **WHEN** a new assistant stream begins after a previous assistant stream ended
- **THEN** the live measurement for the new stream starts from that stream's first output delta
- **AND** previous stream tokens and elapsed time are not included in the new stream's throughput

#### Scenario: Agent latency is excluded from throughput

- **WHEN** there is a delay between the user prompt and the first assistant output delta
- **THEN** that delay is excluded from both live and final throughput calculations

### Requirement: Throughput runtime state is session-scoped

The Pi working-stats extension SHALL clean up live update resources on agent end and session shutdown, and SHALL not reconstruct throughput values from prior sessions.

#### Scenario: Session shutdown clears live resources

- **WHEN** Pi emits session shutdown while live throughput updates are active
- **THEN** the extension stops live update resources
- **AND** no further throughput updates are published for the old session

#### Scenario: New or resumed session starts without inferred throughput

- **WHEN** Pi starts, reloads, creates, or resumes a session
- **THEN** the extension does not infer or publish a throughput value from session history
- **AND** the extension waits for the next assistant stream to produce throughput data
