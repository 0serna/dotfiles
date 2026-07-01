# quota-status Specification

## Purpose

TBD - created by archiving change refactor-quota-status. Update Purpose after archive.

## Requirements

### Requirement: Status format

The status bar SHALL display quota as `Provider percent% reset` without parentheses or window labels.

#### Scenario: Single provider with rolling window

- **WHEN** Codex has 80% remaining with reset at 14:30
- **THEN** status shows `Codex 80% 14:30`

#### Scenario: Both providers healthy

- **WHEN** Codex rolling at 80% reset 14:30, OpenCode rolling at 75% reset 12:00
- **THEN** status shows `Codex 80% 14:30 │ OpenCode 75% 12:00`

### Requirement: Window selection priority

The system SHALL display exactly one window per provider. Priority order: monthly exhausted > weekly exhausted > rolling.

#### Scenario: Monthly exhausted

- **WHEN** OpenCode monthly is 0%, weekly is 60%, rolling is 75%
- **THEN** status shows monthly window (0%)

#### Scenario: Weekly exhausted, monthly healthy

- **WHEN** OpenCode weekly is 0%, monthly is 90%, rolling is 75%
- **THEN** status shows weekly window (0%)

#### Scenario: All windows healthy

- **WHEN** all windows above 0%
- **THEN** status shows rolling window

#### Scenario: Rolling missing, fallback

- **WHEN** rolling window unavailable, weekly at 60%
- **THEN** status shows weekly window

### Requirement: Exhausted state rendering

When the visible window is exhausted (0%), credits/balance SHALL appear in warning color.

#### Scenario: Codex exhausted with credits

- **WHEN** Codex rolling is 0%, credits is 100, banked resets is 2
- **THEN** status shows `Codex 0% 14:30 R2 C100` with R2 in accent, C100 in warning

#### Scenario: Codex exhausted, no resets

- **WHEN** Codex rolling is 0%, credits is 100, banked resets is 0
- **THEN** status shows `Codex 0% 14:30 R0 C100` with R0 in dim, C100 in warning

#### Scenario: OpenCode exhausted with balance

- **WHEN** OpenCode rolling is 0%, balance is $12.34
- **THEN** status shows `OpenCode 0% 12:00 $12.34` with $12.34 in warning

#### Scenario: Healthy window, no warning

- **WHEN** Codex rolling is 80%
- **THEN** no credits/balance shown regardless of balance
