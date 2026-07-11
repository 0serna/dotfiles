# pi-model-routing Specification

## Purpose

Define routing behavior for activating model routes during sessions and slash commands.

## Requirements

### Requirement: Disabled routing without valid configuration

The system SHALL disable automatic command routing behavior when persisted route configuration is missing or invalid.

#### Scenario: Session starts without valid configuration

- **WHEN** Pi emits `session_start` and no valid configuration is available
- **THEN** the system does not attempt to activate any route model or thinking level

#### Scenario: Slash command is submitted without valid configuration

- **WHEN** the user submits a configured slash command and no valid configuration is available
- **THEN** the system does not apply temporary model routing
- **AND** Pi continues processing the input with its current model and thinking level behavior

#### Scenario: Routed command completes without valid configuration

- **WHEN** configuration is not valid
- **THEN** the system does not attempt to restore or activate any route model or thinking level after agent execution

### Requirement: Temporary model and thinking routing

For a routed slash command, the system SHALL attempt to activate the command's route from the configuration and apply that route's thinking level only when valid configuration is available and the configured model activates successfully.

#### Scenario: Routed model activates successfully

- **WHEN** a routed slash command is submitted
- **AND** valid configuration is available
- **AND** its route from the configuration can be activated
- **THEN** the system uses that route's model and thinking level for that prompt execution

#### Scenario: Routed model cannot be activated

- **WHEN** a routed slash command is submitted
- **AND** valid configuration is available
- **AND** its route from the configuration cannot be activated
- **THEN** the system leaves the current model and thinking level unchanged and continues processing the prompt

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
- **AND** the event is not an automatic model-switch clamp
- **AND** the event is not caused by route activation, route restoration, or session-start restoration
- **THEN** the system persists the active model and selected thinking level as the user selection for future sessions and other Pi instances
- **AND** the system records the selected level for that model

#### Scenario: Automatic model-switch clamp occurs

- **WHEN** a manual model switch causes Pi to emit `thinking_level_select` before its corresponding `model_select`
- **AND** the active model identity differs from the last active model identity
- **THEN** the system does not persist the clamped level as the user's manual preference
- **AND** the system does not replace that model's remembered thinking level with the clamped level

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

### Requirement: Named model routes

The system SHALL support configuration defining `light` and `high` routes.

#### Scenario: Configuration supplies light route

- **WHEN** a routed slash command maps to the `light` route
- **AND** valid configuration is available
- **THEN** the system uses that configured route

#### Scenario: Configuration supplies high route

- **WHEN** a routed slash command maps to the `high` route
- **AND** valid configuration is available
- **THEN** the system uses that configured route

### Requirement: Interactive route configuration

The system SHALL provide a `/profile` command that lets the user edit route configuration directly.

#### Scenario: User opens /profile

- **WHEN** the user invokes `/profile`
- **THEN** the system opens the route editor directly
- **AND** does not show a profile selection screen

#### Scenario: User edits route

- **WHEN** the user selects a route in the editor and presses `Enter`
- **THEN** the system prompts for the route model and thinking level

#### Scenario: User saves configuration

- **WHEN** all routes have valid model and thinking level
- **AND** the user presses `Esc` in the route editor
- **THEN** the system saves the configuration
- **AND** does not activate any route after saving
