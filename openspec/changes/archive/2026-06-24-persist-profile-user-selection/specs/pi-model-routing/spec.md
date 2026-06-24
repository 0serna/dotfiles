## MODIFIED Requirements

### Requirement: State restoration after temporary route

After a temporarily routed slash command finishes, the system SHALL restore the user's latest manually selected model and thinking level from extension-owned user selection state, and that state SHALL survive Pi process restarts.

#### Scenario: Session starts with no persisted user selection and an active model

- **WHEN** Pi emits `session_start` with an active model
- **AND** no persisted user selection is available
- **THEN** the system captures that model and current thinking level as the user selection
- **AND** persists the user selection for future sessions

#### Scenario: Session starts with a persisted user selection

- **WHEN** Pi emits `session_start`
- **AND** a persisted user selection is available
- **AND** the selected model can be found and activated
- **THEN** the system restores the persisted model and thinking level
- **AND** uses that selection as the current user snapshot

#### Scenario: Session starts with an unavailable persisted user model

- **WHEN** Pi emits `session_start`
- **AND** a persisted user selection is available
- **AND** the selected model cannot be found or activated
- **THEN** the system leaves Pi's current model and thinking level unchanged
- **AND** does not replace the persisted user selection with Pi's current model

#### Scenario: User selects or cycles model

- **WHEN** Pi emits `model_select` with source `set` or `cycle`
- **AND** the change was not caused by route activation, route restoration, or session-start restoration
- **THEN** the system updates the user snapshot to that model and current thinking level
- **AND** persists the user selection for future sessions

#### Scenario: User changes thinking level

- **WHEN** Pi emits `thinking_level_select` while an active model is available
- **AND** the change was not caused by route activation, route restoration, or session-start restoration
- **THEN** the system updates the user snapshot thinking level
- **AND** persists the user selection for future sessions

#### Scenario: Routed slash command completes

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** a user selection is available
- **THEN** the system restores the user selection model and thinking level

#### Scenario: Routed commands are chained

- **WHEN** multiple routed commands activate route models before restoration
- **THEN** route activation does not replace the user selection with a route model

#### Scenario: User state changes during routed slash command

- **WHEN** the user selects or cycles a model while a routed slash command is executing
- **AND** the routed slash command reaches the end of its agent execution
- **THEN** the system restores the latest user-selected model and thinking level
