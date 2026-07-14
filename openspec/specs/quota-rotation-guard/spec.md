# quota-rotation-guard Specification

## Purpose

Prevent false-positive API key rotations by restricting rotation triggers to genuine quota exhaustion errors (`GoUsageLimitError`) and tracking per-turn account attempts to stop rotating when all accounts have been exhausted. Additionally, handle transient streaming failures with a single retry before giving up.

## Requirements

### Requirement: Rotation only on GoUsageLimitError

The system SHALL trigger OpenCode Go API key rotation only when the `message_end` event's `stopReason` is `"error"` AND the `errorMessage` contains the substring `GoUsageLimitError`.

#### Scenario: GoUsageLimitError triggers rotation

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage` containing `"GoUsageLimitError"` for the `opencode-go` provider
- **THEN** the system SHALL mark the current account as bad with reason `"rate-limited"`
- **AND** the system SHALL activate the next available account
- **AND** the system SHALL queue a `continue` follow-up message

#### Scenario: Timeout error is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage: "Request timed out."` for the `opencode-go` provider
- **THEN** the system SHALL NOT rotate the API key
- **AND** the system SHALL NOT queue a `continue` message

#### Scenario: Stream interruption is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage: "Stream ended without finish_reason"` for the `opencode-go` provider
- **THEN** the system SHALL NOT rotate the API key
- **AND** the system SHALL NOT queue a `continue` message

#### Scenario: Non-opencode-go provider is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` on a provider other than `opencode-go`
- **THEN** the system SHALL NOT rotate any API key

### Requirement: Transient stream retry on streaming failures

The system SHALL retry once with the same account when a streaming failure occurs (`errorMessage` contains `"Streaming response failed"`), without rotating the API key or affecting the shared quota snapshot. If the retry also fails, the system SHALL NOT intervene and SHALL let Pi handle the error naturally.

#### Scenario: First streaming failure triggers retry

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage` containing `"Streaming response failed"` for the `opencode-go` provider
- **AND** no streaming failure has occurred in the current turn
- **AND** no continuation has been sent this turn
- **THEN** the system SHALL increment the per-turn streaming failure counter
- **AND** the system SHALL queue a `continue` follow-up message
- **AND** the system SHALL NOT rotate the API key
- **AND** the system SHALL NOT affect the shared quota snapshot

#### Scenario: Second streaming failure does not retry

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage` containing `"Streaming response failed"` for the `opencode-go` provider
- **AND** a streaming failure has already occurred in the current turn
- **THEN** the system SHALL NOT queue a `continue` message
- **AND** the system SHALL NOT rotate the API key
- **AND** the system SHALL log a `streaming_failure_skipped` event

#### Scenario: Streaming failure counter resets on turn start

- **WHEN** a `turn_start` event fires
- **THEN** the system SHALL reset the per-turn streaming failure counter to 0

#### Scenario: Streaming failure does not retry if continuation already sent

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage` containing `"Streaming response failed"` for the `opencode-go` provider
- **AND** a continuation has already been sent this turn (e.g., from a quota exhaustion rotation)
- **THEN** the system SHALL NOT queue another `continue` message

### Requirement: Per-turn rotation cycle tracking

The system SHALL track which accounts have been attempted for rotation in the current turn using a set of account names, reset on each `turn_start` event.

#### Scenario: Account added to attempted set on rotation

- **WHEN** a legitimate rotation activates a new account
- **THEN** the system SHALL add that account's name to the per-turn attempted set

#### Scenario: Attempted set cleared on turn start

- **WHEN** a `turn_start` event fires
- **THEN** the system SHALL clear the per-turn attempted set
- **AND** the system SHALL reset `continuationSentThisTurn` to false
- **AND** the system SHALL reset the per-turn streaming failure counter to 0

### Requirement: Stop rotation on full cycle exhaustion

The system SHALL stop rotating and notify the user when all configured accounts have been attempted in the current turn following quota errors.

#### Scenario: All accounts attempted, stop rotation

- **WHEN** a legitimate rotation is needed but every configured account's name is already in the per-turn attempted set
- **THEN** the system SHALL NOT activate any account
- **AND** the system SHALL display a UI notification indicating all accounts are exhausted
- **AND** the system SHALL NOT queue a `continue` message

#### Scenario: Partial cycle continues rotation

- **WHEN** a legitimate rotation is needed and at least one configured account is not in the per-turn attempted set
- **THEN** the system SHALL activate the next available non-attempted account
- **AND** the system SHALL add it to the attempted set

### Requirement: Rotation logging reflects actual reason

The system SHALL log rotation events with the reason that reflects the actual trigger (always `"rate-limited"` since only `GoUsageLimitError` triggers rotation).

#### Scenario: Rotation logged with rate-limited reason

- **WHEN** a legitimate rotation occurs due to `GoUsageLimitError`
- **THEN** the system SHALL log `rotate_attempt` and `rotate_success` with `reason: "rate-limited"`

#### Scenario: Skipped rotation is not logged as rotation

- **WHEN** the handler decides not to rotate because the error is not `GoUsageLimitError`
- **THEN** the system SHALL NOT log `rotate_attempt` or `message_end_error`
