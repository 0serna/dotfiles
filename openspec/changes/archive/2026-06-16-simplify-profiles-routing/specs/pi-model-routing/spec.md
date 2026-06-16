## MODIFIED Requirements

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

After a temporarily routed slash command finishes, the system SHALL restore the user's latest selected model and thinking level without using a default route.

#### Scenario: Session starts with an active model

- **WHEN** Pi emits `session_start` with an active model
- **THEN** the system captures that model and current thinking level as the user snapshot

#### Scenario: User selects or cycles model

- **WHEN** Pi emits `model_select` with source `set` or `cycle`
- **THEN** the system updates the user snapshot to that model and current thinking level

#### Scenario: User changes thinking level

- **WHEN** Pi emits `thinking_level_select` while an active model is available
- **AND** the change was not caused by route activation or route restoration
- **THEN** the system updates the user snapshot thinking level

#### Scenario: Routed slash command completes

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** a user snapshot is available
- **THEN** the system restores the snapshot model and thinking level

#### Scenario: Routed commands are chained

- **WHEN** multiple routed commands activate route models before restoration
- **THEN** route activation does not replace the user snapshot with a route model

#### Scenario: User state changes during routed slash command

- **WHEN** the user selects or cycles a model while a routed slash command is executing
- **AND** the routed slash command reaches the end of its agent execution
- **THEN** the system restores the latest user-selected model and thinking level

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

## REMOVED Requirements

### Requirement: Default session model routing

**Reason**: Pi already remembers the user's last selected model, so extension-level default activation duplicates native behavior and overrides user intent.
**Migration**: Users should select their base model with Pi's native set/cycle controls.

### Requirement: Persistent configuration

**Reason**: This requirement is duplicated by the profile-configuration capability and remains covered there.
**Migration**: Use `pi-model-profile-configuration` for route configuration persistence requirements.
