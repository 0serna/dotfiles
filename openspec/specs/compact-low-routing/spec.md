# compact-low-routing Specification

## Purpose

Route compaction summarization to the active profile's low-capacity route (`low`) to keep summarization on the base model and avoid switching to a more expensive tier.

## Requirements

### Requirement: Compaction triggers low-model routing

The system SHALL switch to the active profile's `low` model and thinking level before compaction summarization runs, provided valid profile configuration is active and no command-based route is currently in progress.

#### Scenario: Manual `/compact` with valid profile and no active route

- **WHEN** the user invokes `/compact` (or auto-compaction triggers)
- **AND** valid profile configuration is available
- **AND** no command-based route snapshot is active
- **THEN** the system saves a snapshot of the current model and thinking level
- **AND** activates the active profile's `low` route
- **AND** compaction summarization uses the `low` model

#### Scenario: Compaction with active command route (skip)

- **WHEN** compaction triggers (manual or auto)
- **AND** a command-based route snapshot is already active (e.g. high model from `/opsx-propose`)
- **THEN** the system does not switch models
- **AND** compaction proceeds with whatever model is currently active

#### Scenario: Profile configuration is invalid or missing

- **WHEN** compaction triggers
- **AND** profile configuration is not valid
- **THEN** the system does not switch models
- **AND** compaction proceeds with the current model

#### Scenario: Low model cannot be activated

- **WHEN** compaction triggers
- **AND** valid profile configuration is available
- **AND** the low model cannot be activated (e.g. missing API key)
- **THEN** the system does not save a snapshot
- **AND** compaction proceeds with the current model

### Requirement: Restore pre-compaction model after compaction

After compaction completes, the system SHALL restore the model and thinking level that were active before the low-model switch.

#### Scenario: Compaction completes with low model

- **WHEN** compaction was routed to the low model
- **AND** compaction completes successfully
- **THEN** the system restores the model and thinking level from the saved snapshot

#### Scenario: Compaction was cancelled or failed

- **WHEN** compaction was routed to the low model
- **AND** compaction is cancelled or fails before `session_compact` fires
- **THEN** the snapshot is not consumed (Pi does not emit `session_compact` on failure)
- **AND** the next successful compaction or session event handles cleanup
