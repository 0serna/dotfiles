## MODIFIED Requirements

### Requirement: Working message shows elapsed agent time

The working-stats extension SHALL publish a working message via `setWorkingMessage` that displays the processing-cycle duration from its first agent attempt until Pi becomes settled and idle.

#### Scenario: Agent run starts

- **WHEN** Pi emits the first `agent_start` for a processing cycle
- **THEN** the extension records the cycle start time and initial model
- **AND** publishes a working message formatted as `0:00 · 0 tok/s`

#### Scenario: Later agent attempt starts

- **WHEN** Pi emits another `agent_start` before the processing cycle is settled and idle
- **THEN** the extension preserves the original cycle start time
- **AND** continues the existing elapsed-time measurement

#### Scenario: Active run updates once per second

- **WHEN** a processing cycle is active
- **THEN** the extension updates the working message at approximately one-second intervals
- **AND** elapsed time includes model generation, tool execution, retry backoff, compaction recovery, and waits between attempts

#### Scenario: Agent attempt ends before settlement

- **WHEN** Pi emits `agent_end` while retry, compaction recovery, or continuation work can still occur
- **THEN** the extension does not publish a completion notification
- **AND** preserves timing and throughput state for later attempts

#### Scenario: Settlement handler observes new work

- **WHEN** Pi emits `agent_settled`
- **AND** `ctx.isIdle()` is false because another extension started work
- **THEN** the extension keeps the processing cycle active
- **AND** defers completion until a later idle settlement

#### Scenario: Active run completes

- **WHEN** Pi emits `agent_settled`
- **AND** `ctx.isIdle()` is true
- **AND** a processing cycle is active
- **THEN** the extension stops live updates
- **AND** publishes exactly one completion notification using the total processing-cycle duration
- **AND** clears the working message

### Requirement: Working message shows assistant token throughput

The working-stats extension SHALL include assistant output throughput in the working message only while an assistant stream is actively producing output deltas.

#### Scenario: Placeholder before first stream

- **WHEN** no assistant stream has occurred in the active processing cycle
- **THEN** the working message displays `0 tok/s` as the throughput portion

#### Scenario: Live throughput during generation

- **WHEN** an assistant stream has produced output deltas and the next interval tick occurs
- **THEN** the working message displays an estimated throughput formatted as `N tok/s`
- **AND** the value is calculated as estimated output tokens divided by elapsed seconds since the first output delta

#### Scenario: Live throughput counts total streamed output

- **WHEN** an assistant stream emits text, thinking, or tool-call deltas
- **THEN** the live estimate includes those deltas
- **AND** the estimate is not limited to visible assistant text

#### Scenario: Placeholder after stream ends

- **WHEN** an assistant stream ends while the processing cycle remains active
- **THEN** the working message reverts to the `0 tok/s` placeholder

### Requirement: Final throughput is stored for the completion notification

The working-stats extension SHALL retain the latest valid final throughput across attempts in one processing cycle and surface it only in the settled completion notification.

#### Scenario: Final throughput recorded on stream end with usage

- **WHEN** an assistant stream ends with provider usage containing a positive output token count
- **THEN** the extension stores the final throughput calculated from provider-reported output tokens

#### Scenario: Last final preserved when usage is unavailable

- **WHEN** a later assistant stream or attempt ends without usable output usage
- **THEN** the extension preserves the latest valid final throughput from the processing cycle

#### Scenario: Completion notification includes final throughput

- **WHEN** the processing cycle settles while idle
- **THEN** the completion notification uses the last responding model
- **AND** falls back to the initial model if no assistant response exists
- **AND** includes the latest valid final throughput when available
- **AND** retains the compact `✓ model · duration · throughput` format without an attempt count

#### Scenario: Completion follows a failed or aborted outcome

- **WHEN** a failed or aborted processing cycle becomes settled and idle
- **THEN** the extension still uses `✓` as the completion marker
- **AND** the marker communicates settlement rather than success

### Requirement: Extension cleans up runtime resources

The working-stats extension SHALL clean up processing-cycle resources on idle settlement and session shutdown.

#### Scenario: Interval stops on agent end

- **WHEN** an active processing cycle becomes settled and idle
- **THEN** the extension clears the live update interval
- **AND** does not publish further updates for that cycle

#### Scenario: Session shutdown clears all state

- **WHEN** Pi emits `session_shutdown`
- **THEN** the extension clears any active interval
- **AND** resets all throughput, model-attribution, and timing state
- **AND** clears the working message
- **AND** does not publish a completion notification
