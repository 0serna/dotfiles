## Purpose

Display live and final assistant output throughput in the Pi footer, showing tokens per second for each assistant stream.

## Requirements

### Requirement: Footer displays assistant output throughput

The Pi assistant throughput extension SHALL publish a compact footer status representing assistant output tokens per second for the current or most recent assistant stream.

#### Scenario: Publish live throughput during generation

- **WHEN** an assistant stream has produced output deltas for at least one second
- **THEN** the footer displays a live estimated throughput status formatted as `<integer> tok/s`
- **AND** the value is calculated as estimated output tokens divided by elapsed generation seconds since the first output delta

#### Scenario: Live throughput counts total streamed output

- **WHEN** an assistant stream emits text, thinking, or tool-call deltas
- **THEN** the live estimate includes those deltas in the estimated output token count
- **AND** the estimate is not limited to visible assistant text only

#### Scenario: Do not show unstable initial live value

- **WHEN** an assistant stream has produced its first output delta less than one second ago
- **THEN** the extension does not publish a new live throughput value for that stream yet

### Requirement: Footer replaces live estimate with precise final throughput

The Pi assistant throughput extension SHALL replace the live throughput estimate with a final throughput value when an assistant stream closes and precise output usage is available.

#### Scenario: Publish final throughput on message end

- **WHEN** an assistant stream ends with provider usage containing an output token count
- **THEN** the footer displays final throughput formatted as `<integer> tok/s`
- **AND** the value is calculated as provider-reported output tokens divided by elapsed seconds from the first output delta to message end

#### Scenario: Preserve last precise value when usage is unavailable

- **WHEN** an assistant stream ends without provider output usage
- **THEN** the extension preserves the previously displayed final precise throughput value when one exists
- **AND** the extension does not publish the live estimate as a final precise value

#### Scenario: Keep final throughput while tools execute

- **WHEN** an assistant stream has ended with final precise throughput and tools execute before another assistant stream starts
- **THEN** the footer continues to display the last final throughput value

### Requirement: Throughput measurement is scoped to one assistant stream

The Pi assistant throughput extension SHALL measure each assistant stream independently rather than accumulating throughput across a full user prompt or agent run.

#### Scenario: New assistant stream resets live measurement

- **WHEN** a new assistant stream begins after a previous assistant stream ended
- **THEN** the live measurement for the new stream starts from that stream's first output delta
- **AND** previous stream tokens and elapsed time are not included in the new stream's throughput

#### Scenario: Agent latency is excluded from throughput

- **WHEN** there is a delay between the user prompt and the first assistant output delta
- **THEN** that delay is excluded from both live and final throughput calculations

### Requirement: Footer orders throughput after model information

The Pi custom footer SHALL place the assistant throughput status immediately after the model/thinking section when the throughput status is present.

#### Scenario: Throughput status appears after model section

- **WHEN** the footer renders with model/thinking information and a throughput status
- **THEN** the throughput status appears immediately after the model/thinking section
- **AND** the throughput status does not also appear in the generic remaining extension statuses

### Requirement: Throughput runtime state is session-scoped

The Pi assistant throughput extension SHALL clean up live update resources on stream completion and session shutdown, and SHALL not reconstruct throughput values from prior sessions.

#### Scenario: Session shutdown clears live resources

- **WHEN** Pi emits session shutdown while live throughput updates are active
- **THEN** the extension stops live update resources
- **AND** no further live throughput updates are published for the old session

#### Scenario: New or resumed session starts without inferred throughput

- **WHEN** Pi starts, reloads, creates, or resumes a session
- **THEN** the extension does not infer or publish a throughput value from session history
- **AND** the extension waits for the next assistant stream to produce throughput data
