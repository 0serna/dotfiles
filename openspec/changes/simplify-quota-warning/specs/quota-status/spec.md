## MODIFIED Requirements

### Requirement: Exhausted state rendering

When the visible window is exhausted (0%), credits/balance SHALL appear in warning color. Percentage and reset time SHALL NOT use warning color regardless of remaining percentage.

#### Scenario: Codex exhausted with credits

- **WHEN** Codex rolling is 0%, credits is 100, banked resets is 2
- **THEN** status shows `Codex 0% 14:30 R2 C100` with R2 in accent, C100 in warning, percentage in dim

#### Scenario: Codex exhausted, no resets

- **WHEN** Codex rolling is 0%, credits is 100, banked resets is 0
- **THEN** status shows `Codex 0% 14:30 C100` with C100 in warning

#### Scenario: OpenCode exhausted with balance

- **WHEN** OpenCode rolling is 0%, balance is $12.34
- **THEN** status shows `OpenCode 0% 12:00 $12.34` with $12.34 in warning

#### Scenario: Healthy window, no warning

- **WHEN** Codex rolling is 80%
- **THEN** no credits/balance shown, percentage in dim

#### Scenario: Low percentage, no warning

- **WHEN** Codex rolling is 15%, credits is 50
- **THEN** percentage displayed in dim (not warning), no credits shown

## ADDED Requirements

### Requirement: Resets visibility in compact

Banked resets (`R`) SHALL appear in compact status only when a window is exhausted (0%). When all windows are healthy, resets SHALL NOT be displayed in compact.

#### Scenario: Exhausted window with resets

- **WHEN** Codex rolling is 0%, banked resets is 3
- **THEN** status shows `R3` in accent color

#### Scenario: Healthy window with resets available

- **WHEN** Codex rolling is 80%, banked resets is 3
- **THEN** `R` segment not shown in compact status

#### Scenario: Exhausted window with zero resets

- **WHEN** Codex rolling is 0%, banked resets is 0
- **THEN** status shows `R0` in dim color
