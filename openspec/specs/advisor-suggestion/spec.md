# advisor-suggestion Specification

## Purpose

TBD - created by archiving change advisor-hints-extension. Update Purpose after archive.

## Requirements

### Requirement: Extension suggests advisor after substantial work

When the agent has done substantial work, the extension SHALL suggest considering `advisor` for self-review while leaving the final decision to the agent.

The suggestion SHALL operate at two levels:

1. A passive guideline appended to the system prompt at the start of each user prompt
2. An active steer message injected via `pi.sendMessage` with `customType: "advisor-hint"` and `triggerTurn: true` at `turn_end` whenever counted tool calls reach another multiple of `TOOL_CALL_THRESHOLD` and `advisor` was not called in that turn

The hint message SHALL use a custom message type rather than a user message, to avoid polluting the conversation history.

The extension SHALL track the following turn-level state:

- Total calls to `bash`, `read`, `edit`, or `write` since the last `advisor` call (other tools are not counted)
- The next tool-call threshold at which a `turn_end` hint should fire
- Whether the `advisor` tool was called during the current turn

The extension SHALL gate `turn_end` hints on:

- The `advisor` tool was NOT called during the current turn
- The counted tool total meets or exceeds the next threshold multiple of `TOOL_CALL_THRESHOLD`

The extension SHALL only count `bash`, `read`, `edit`, and `write` tool calls toward the threshold. Other tools (`web_search`, `web_fetch`, `question`, `advisor`, etc.) SHALL NOT increment the counter.

The extension SHALL reset the counted tool total and next threshold progression when `advisor` is used, so that work already reviewed via advisor does not immediately re-trigger a `turn_end` hint.

The extension SHALL NOT use cooldown or debounce logic. Hints are never suppressed based on timing of previous hints or advisor usage.

All thresholds SHALL be defined as module-level constants.

#### Scenario: Tool counter resets at each new prompt

- **WHEN** a new prompt begins processing (`agent_start`)
- **THEN** the counted tool total SHALL be reset to `0`
- **AND** the next hint threshold SHALL be reset to `TOOL_CALL_THRESHOLD`

#### Scenario: Passive guideline is always appended at prompt start

- **WHEN** a user prompt begins processing
- **THEN** the system prompt SHALL include a guideline suggesting advisor use when this work ends up being important or worth validating before responding

#### Scenario: Active hint is injected at turn_end after the first threshold is reached

- **WHEN** the agent completes a turn
- **AND** counted tool calls since the last `advisor` use meet or exceed `TOOL_CALL_THRESHOLD`
- **AND** the `advisor` tool was NOT called during that turn
- **THEN** the extension SHALL inject a steer message via `pi.sendMessage` with `triggerTurn: true`

#### Scenario: Active hint repeats at later threshold multiples

- **WHEN** the agent continues working without using `advisor`
- **AND** counted tool calls later reach another multiple of `TOOL_CALL_THRESHOLD`
- **THEN** the extension SHALL inject another `turn_end` hint

#### Scenario: Turn_end hint is suppressed when advisor was called this turn

- **WHEN** the agent completes a turn
- **AND** the `advisor` tool was called during that turn
- **THEN** the extension SHALL NOT inject a steer message at `turn_end`

#### Scenario: Advisor usage is logged

- **WHEN** the agent calls the `advisor` tool
- **THEN** the extension SHALL log an `advisor` event to `~/.local/state/pi/advisor-hints.log`
- **AND** the log entry SHALL include `sessionId` and `toolCalls` (before reset) in JSON format

#### Scenario: Advisor usage resets threshold progression

- **WHEN** the agent calls the `advisor` tool
- **THEN** the counted tool total SHALL be reset to `0`
- **AND** the next hint threshold SHALL be reset to `TOOL_CALL_THRESHOLD`

#### Scenario: Turn_end hint leaves advisor use to the agent's judgment

- **WHEN** the extension injects the `turn_end` hint
- **THEN** the hint wording SHALL be conditional
- **AND** the hint SHALL leave it to the agent to decide whether to use advisor immediately for difficulty, use advisor before responding for important work that merits validation, or skip advisor when the task is simple and does not need review

#### Scenario: Hint delivery is logged

- **WHEN** the extension injects a `turn_end` steer message
- **THEN** the extension SHALL log a `hint` event to `~/.local/state/pi/advisor-hints.log`
- **AND** the log entry SHALL include `sessionId` and `toolCalls` in JSON format

#### Scenario: Log file rotation

- **GIVEN** the log file exceeds 2000 lines
- **WHEN** the extension appends a new event
- **THEN** the extension SHALL truncate the file to the most recent 2000 lines

#### Scenario: Logging never blocks hint delivery

- **GIVEN** file system is unwritable (permissions, full disk, etc.)
- **WHEN** the extension tries to log an event
- **THEN** the extension SHALL silently ignore the error
- **AND** the hint SHALL still be injected
