# quota-command Specification

## Purpose

Displays detailed quota information for all providers with account rotation support.

## Requirements

### Requirement: /quota command displays full detail

The system SHALL register a `/quota` command that displays detailed quota information for all providers in a formatted block and indicates the currently active OpenCode Go account.

#### Scenario: Command execution with active account

- **WHEN** user types `/quota`
- **THEN** system refreshes quota data and displays formatted block with all windows, credits, and resets for each provider
- **AND** the active OpenCode Go account name is shown in the header or a status line

### Requirement: Block format

The `/quota` output SHALL use box-drawing characters with provider headers and aligned columns.

#### Scenario: Full output with both providers

- **WHEN** both Codex and OpenCode data available
- **THEN** output shows:

```text
┌─ Codex ─────────────────────┐
│ Rolling   80%  reset 14:30  │
│ Weekly    45%  reset 3d     │
│ Credits   100               │
│ Resets    3                 │
│   #1 in 30d                 │
│   #2 in 27d                 │
│   #3 in 12d                 │
├─ OpenCode Go ───────────────┤
│ Rolling   75%  reset 12:00  │
│ Weekly    60%  reset 5d     │
│ Monthly   90%  reset 28d    │
│ Balance   $12.34            │
└─────────────────────────────┘
```

#### Scenario: Codex has zero available reset credits

- **WHEN** the new reset-credits endpoint reports an empty available set
- **THEN** the Codex section shows the `Resets 0` row with no `#n` sub-lines

#### Scenario: Codex reset-credits endpoint failed

- **WHEN** the new reset-credits endpoint fetch fails
- **THEN** the Codex section omits the `Resets` row entirely and shows no sub-lines

#### Scenario: Provider with error

- **WHEN** Codex fetch failed
- **THEN** Codex section shows `error` in warning color

#### Scenario: Missing windows

- **WHEN** provider has no weekly window
- **THEN** weekly row omitted from output

### Requirement: Per-credit expiry display

The `/quota` Codex block SHALL list each available reset credit on a separate sub-line under the `Resets` row, showing the time remaining until expiry in relative form.

#### Scenario: Sub-line per available credit

- **WHEN** Codex has N available reset credits with valid expiry dates
- **THEN** the Codex block renders one sub-line per credit under the `Resets N` row
- **AND** each sub-line uses the format `  #<index> in <relative>`
- **AND** the sub-lines are ordered by `expiresAt` ascending (soonest first)

#### Scenario: Relative time formatting

- **WHEN** a sub-line is rendered
- **THEN** the relative label is `in <d>d` for remaining time ≥ 24 hours (rounded to nearest day)
- **AND** `in <h>h` for remaining time between 1 hour and 24 hours (rounded to nearest hour, minimum 1h)
- **AND** `expired` when `expiresAt` is in the past
- **AND** the `status` field is not displayed in the sub-line

#### Scenario: Non-available credits are excluded

- **WHEN** the response includes credits with `status` other than `available`
- **THEN** those credits are excluded from the sub-line list and from the `Resets` count
- **AND** they do not appear anywhere in the Codex block

### Requirement: Active account indication

The `/quota` output SHALL indicate which OpenCode Go account is currently active via the runtime API key.

#### Scenario: Account 1 active

- **WHEN** `/quota` is executed and account "1" is active
- **THEN** the OpenCode Go section header reads `OpenCode 1` for the active account
- **AND** inactive accounts are labeled with their account names

### Requirement: Command refreshes data

The `/quota` command SHALL fetch fresh data before displaying, not rely solely on cache.

#### Scenario: Fresh fetch

- **WHEN** user runs `/quota`
- **THEN** system calls fetchCodexQuotaStatus and fetchOpenCodeGoData before rendering
