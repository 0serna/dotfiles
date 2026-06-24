## MODIFIED Requirements

### Requirement: State restoration after temporary route

After a temporarily routed slash command finishes, the system SHALL restore the user's latest manually selected model and thinking level by reading extension-owned user selection state from disk at restoration time, and that state SHALL survive Pi process restarts.

#### Scenario: Session starts with no persisted user selection and an active model

- **WHEN** Pi emits `session_start` with an active model
- **AND** no persisted user selection is available
- **THEN** the system captures that model and current thinking level as the user selection
- **AND** persists the user selection for future sessions

#### Scenario: Session starts with a persisted user selection

- **WHEN** Pi emits `session_start`
- **AND** a persisted user selection is available on disk
- **AND** the selected model can be found and activated
- **THEN** the system restores the persisted model and thinking level

#### Scenario: Session starts with an unavailable persisted user model

- **WHEN** Pi emits `session_start`
- **AND** a persisted user selection is available on disk
- **AND** the selected model cannot be found or activated
- **THEN** the system leaves Pi's current model and thinking level unchanged
- **AND** does not replace the persisted user selection with Pi's current model

#### Scenario: User selects or cycles model

- **WHEN** Pi emits `model_select` with source `set` or `cycle`
- **AND** the change was not caused by route activation, route restoration, or session-start restoration
- **THEN** the system persists that model and current thinking level as the user selection for future sessions and other Pi instances

#### Scenario: User changes thinking level

- **WHEN** Pi emits `thinking_level_select` while an active model is available
- **AND** the change was not caused by route activation, route restoration, or session-start restoration
- **THEN** the system persists the active model and selected thinking level as the user selection for future sessions and other Pi instances

#### Scenario: Routed slash command completes after another instance changed the user selection

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** another Pi instance has persisted a newer user selection while the route was active
- **THEN** the system reads the user selection from disk at restoration time
- **AND** restores the latest persisted model and thinking level

#### Scenario: Routed slash command completes without a persisted user selection

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** no persisted user selection is available on disk
- **THEN** the system leaves Pi's current model and thinking level unchanged

#### Scenario: Routed commands are chained

- **WHEN** multiple routed commands activate route models before restoration
- **THEN** route activation does not persist a route model as the user selection

#### Scenario: User state changes during routed slash command in the same instance

- **WHEN** the user selects or cycles a model while a routed slash command is executing
- **AND** the routed slash command reaches the end of its agent execution
- **THEN** the system reads the user selection from disk at restoration time
- **AND** restores the latest persisted model and thinking level
