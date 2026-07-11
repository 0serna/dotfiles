## MODIFIED Requirements

### Requirement: /quota command displays full detail

The system SHALL register a `/quota` command that displays detailed quota information for all providers in a formatted block and indicates the currently active OpenCode Go account.

#### Scenario: Command execution with active account

- **WHEN** user types `/quota`
- **THEN** system refreshes quota data and displays formatted block with all windows, credits, and resets for each provider
- **AND** the active OpenCode Go account name is shown in the header or a status line

## ADDED Requirements

### Requirement: Active account indication

The `/quota` output SHALL indicate which OpenCode Go account is currently active via the runtime API key.

#### Scenario: Account 1 active

- **WHEN** `/quota` is executed and account "1" is active
- **THEN** the OpenCode Go section header reads `OpenCode 1` for the active account
- **AND** inactive accounts are labeled with their account names
