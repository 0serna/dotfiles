## MODIFIED Requirements

### Requirement: Footer cache percentage represents prompt-side cache reuse

The Pi footer SHALL display cache percentage as the latest assistant turn's prompt-side cache reuse rate, with a directional indicator showing trend vs the preceding turn, and SHALL change to a warning color when the rate drops sharply between adjacent turns.

#### Scenario: Display cache-hit percentage from the latest assistant turn

- **WHEN** the latest assistant message in the session has usage data including both fresh prompt input tokens and cache-read prompt input tokens
- **THEN** the footer displays cache percentage as cache-read tokens divided by total prompt-side input tokens for that single turn
- **AND** output tokens and cache-write tokens are excluded from that percentage
- **AND** the displayed value is rounded to the nearest integer percent

#### Scenario: Trend indicator shows improvement

- **WHEN** the latest turn's cache hit rate is higher than the preceding turn's cache hit rate
- **THEN** the footer displays an upward arrow after the cache percentage

#### Scenario: Trend indicator shows decline

- **WHEN** the latest turn's cache hit rate is lower than the preceding turn's cache hit rate
- **THEN** the footer displays a downward arrow after the cache percentage

#### Scenario: No trend indicator on first turn

- **WHEN** there is only one assistant message with usage data in the session
- **THEN** the footer displays cache percentage without a trend indicator

#### Scenario: Regression warning via color change

- **WHEN** the latest turn's cache hit rate is lower than the preceding turn's cache hit rate by at least a configured drop threshold (default 25 percentage points)
- **THEN** the footer displays the cache segment in a visually distinct warning color

#### Scenario: Cache percentage shows zero without prompt-side input

- **WHEN** the latest assistant message has no prompt-side input tokens in its usage data
- **THEN** the footer displays `cache 0%`

#### Scenario: Cache unsupported shows dash

- **WHEN** all assistant messages in the session have zero cache-read tokens (`cacheRead === 0`) but have usage data
- **THEN** the footer displays `cache —`
- **AND** no trend arrow or regression color is shown

#### Scenario: No data on first turn shows zero

- **WHEN** there are no assistant messages with usage data yet (first turn of session)
- **THEN** the footer displays `cache 0%`
- **AND** no trend arrow or regression color is shown

## ADDED Requirements

### Requirement: Extension logs significant events

The extension SHALL log diagnostic events for session lifecycle, cache regression detection, and error conditions to the shared logger.

#### Scenario: Log extension loaded on session start

- **WHEN** a new session starts
- **THEN** the extension logs an `extension_loaded` event with the current working directory

#### Scenario: Log cache regression detected

- **WHEN** a regression is detected (drop ≥25pp between adjacent turns)
- **THEN** the extension logs a `regression_detected` event with previous hit rate, current hit rate, and drop amount

#### Scenario: Log error on status publish failure

- **WHEN** an error occurs while computing or publishing the footer status
- **THEN** the extension logs a `status_error` event with the error message
