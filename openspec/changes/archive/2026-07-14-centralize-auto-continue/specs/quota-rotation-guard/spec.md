## MODIFIED Requirements

### Requirement: Rotation only on GoUsageLimitError

The system SHALL trigger OpenCode Go API key rotation only when the `message_end` event's `stopReason` is `"error"` AND the `errorMessage` contains the substring `GoUsageLimitError`. After successful rotation, quota SHALL request continuation from `auto-continue` rather than dispatching a user message directly.

#### Scenario: GoUsageLimitError triggers rotation

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage` containing `"GoUsageLimitError"` for the `opencode-go` provider
- **THEN** the system SHALL mark the current account as bad with reason `"rate-limited"`
- **AND** the system SHALL activate the next available account
- **AND** the quota extension SHALL request automatic continuation with reason `quota-rotation`
- **AND** the quota extension SHALL NOT directly send a `continue` user message

#### Scenario: Timeout error is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage: "Request timed out."` for the `opencode-go` provider
- **THEN** the quota extension SHALL NOT rotate the API key
- **AND** the quota extension SHALL NOT request a `quota-rotation` continuation

#### Scenario: Stream interruption is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` and `errorMessage: "Stream ended without finish_reason"` for the `opencode-go` provider
- **THEN** the quota extension SHALL NOT rotate the API key
- **AND** the quota extension SHALL NOT request a `quota-rotation` continuation

#### Scenario: Non-opencode-go provider is ignored

- **WHEN** `message_end` fires with `stopReason: "error"` on a provider other than `opencode-go`
- **THEN** the quota extension SHALL NOT rotate any API key
- **AND** SHALL NOT request a `quota-rotation` continuation

### Requirement: Per-turn rotation cycle tracking

The system SHALL track which accounts have been attempted for rotation in the current turn using a set of account names, reset on each `turn_start` event.

#### Scenario: Account added to attempted set on rotation

- **WHEN** a legitimate rotation activates a new account
- **THEN** the system SHALL add that account's name to the per-turn attempted set

#### Scenario: Attempted set cleared on turn start

- **WHEN** a `turn_start` event fires
- **THEN** the system SHALL clear the per-turn attempted set

### Requirement: Stop rotation on full cycle exhaustion

The system SHALL stop rotating and notify the user when all configured accounts have been attempted in the current turn following quota errors.

#### Scenario: All accounts attempted, stop rotation

- **WHEN** a legitimate rotation is needed but every configured account's name is already in the per-turn attempted set
- **THEN** the system SHALL NOT activate any account
- **AND** the system SHALL display a UI notification indicating all accounts are exhausted
- **AND** the quota extension SHALL NOT request automatic continuation

#### Scenario: Partial cycle continues rotation

- **WHEN** a legitimate rotation is needed and at least one configured account is not in the per-turn attempted set
- **THEN** the system SHALL activate the next available non-attempted account
- **AND** the system SHALL add it to the attempted set
- **AND** the quota extension SHALL request automatic continuation with reason `quota-rotation`

## REMOVED Requirements

### Requirement: Transient stream retry on streaming failures

**Reason**: Transient failure recovery is provider-agnostic and no longer belongs to quota rotation. Keeping it here would duplicate continuation ownership and prevent equivalent recovery for other providers.

**Migration**: Use the new `pi-auto-continue` capability, which classifies explicit transient signals for every provider and bounds recovery with a Recovery Episode.
