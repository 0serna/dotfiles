# quota-command Specification

## Purpose

TBD - created by archiving change refactor-quota-status. Update Purpose after archive.

## Requirements

### Requirement: /quota command displays full detail

The system SHALL register a `/quota` command that displays detailed quota information for all providers in a formatted block.

#### Scenario: Command execution

- **WHEN** user types `/quota`
- **THEN** system refreshes quota data and displays formatted block with all windows, credits, and resets for each provider

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
├─ OpenCode Go ───────────────┤
│ Rolling   75%  reset 12:00  │
│ Weekly    60%  reset 5d     │
│ Monthly   90%  reset 28d    │
│ Balance   $12.34            │
└─────────────────────────────┘
```

#### Scenario: Provider with error

- **WHEN** Codex fetch failed
- **THEN** Codex section shows `error` in warning color

#### Scenario: Missing windows

- **WHEN** provider has no weekly window
- **THEN** weekly row omitted from output

### Requirement: Command refreshes data

The `/quota` command SHALL fetch fresh data before displaying, not rely solely on cache.

#### Scenario: Fresh fetch

- **WHEN** user runs `/quota`
- **THEN** system calls fetchCodexQuotaStatus and fetchOpenCodeGoData before rendering
