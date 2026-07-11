## ADDED Requirements

### Requirement: Balanced account selection on session start

The system SHALL, when a session starts, fetch current quota for every configured OpenCode Go account and consider an account eligible only when its monthly, weekly, and rolling windows all have remaining quota. Among eligible accounts, the system SHALL select the account with the highest minimum remaining percentage across those three windows. Ties SHALL be resolved by monthly, then weekly, then rolling remaining percentage. The selected account SHALL be activated via `authStorage.setRuntimeApiKey("opencode-go", apiKey)`.

#### Scenario: Select the most balanced account

- **WHEN** account "1" has windows `90/5/90` and account "2" has windows `80/80/80` for monthly/weekly/rolling
- **THEN** account "1" has score 5 and account "2" has score 80
- **AND** the extension activates account "2"

#### Scenario: Exhausted monthly window is rejected

- **WHEN** account "1" has windows `0/88/100` and account "2" has windows `60/70/80`
- **THEN** account "1" is rejected because its monthly window is exhausted
- **AND** the extension activates account "2"

#### Scenario: Missing quota window is rejected

- **WHEN** an account does not report one of the monthly, weekly, or rolling windows
- **THEN** that account is not eligible for activation

#### Scenario: No account has all quota windows available

- **WHEN** no configured account has all three quota windows above 0%
- **THEN** the extension does not activate an account
- **AND** the extension notifies the user that all accounts appear exhausted or unavailable

### Requirement: Automatic rotation on provider error

The system SHALL detect OpenCode Go provider errors at the end of an assistant message and rotate to the next available account.

#### Scenario: 429 rate-limit error

- **WHEN** an assistant message ends with `stopReason === "error"` and the error indicates a 429 for provider "opencode-go"
- **THEN** the current account is marked as rate-limited and enters cooldown
- **AND** the extension selects the next account with available quota and no active cooldown
- **AND** the extension calls `setRuntimeApiKey("opencode-go", nextAccountApiKey)`

#### Scenario: 401 unauthorized error

- **WHEN** an assistant message ends with `stopReason === "error"` and the error indicates a 401 or 403 for provider "opencode-go"
- **THEN** the current account is marked as unauthorized and enters cooldown
- **AND** the extension rotates to the next available account
- **AND** the extension calls `setRuntimeApiKey("opencode-go", nextAccountApiKey)`

#### Scenario: All accounts exhausted

- **WHEN** all accounts are on cooldown or have no quota
- **THEN** the extension notifies the user that all accounts are exhausted
- **AND** the extension does not change the active key

### Requirement: Cooldown state tracking

The system SHALL track per-account cooldown state in memory only; the state MUST NOT persist across sessions.

#### Scenario: Cooldown expiration

- **WHEN** an account was marked bad 60 seconds ago with a 60-second cooldown
- **THEN** the account is eligible for selection again

#### Scenario: Cooldown active

- **WHEN** an account was marked bad less than `cooldownMs` ago
- **THEN** the account is skipped during rotation

### Requirement: Fallback continuation after rotation

The system SHALL queue a continuation message when it rotates due to a provider error, so the agent resumes without user intervention.

#### Scenario: Provider error during a turn

- **WHEN** the extension rotates to a new account after a provider error
- **THEN** it queues a `continue` user message as a follow-up
- **AND** the next assistant turn uses the newly selected account

### Requirement: Session-scoped state

The system SHALL clear all rotation state on `session_shutdown`.

#### Scenario: New session starts after shutdown

- **WHEN** a new session starts after the previous session shut down
- **THEN** rotation state is reset and the selection starts fresh
