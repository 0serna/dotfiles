## ADDED Requirements

### Requirement: Named model profiles

The system SHALL support named model profiles where each profile defines a default route, a light route, and a heavy route.

#### Scenario: Active profile supplies default route

- **WHEN** the system needs the default route
- **THEN** the system uses the default route from the active model profile

#### Scenario: Active profile supplies temporary route

- **WHEN** a routed slash command maps to a light or heavy route
- **THEN** the system uses that route from the active model profile

### Requirement: Interactive model profile selection

The system SHALL provide a `/model-profile` command that lets the user select the active model profile interactively.

#### Scenario: User selects model profile

- **WHEN** the user invokes `/model-profile` and selects a profile
- **THEN** the system records the selected profile as active
- **AND** the system attempts to activate the selected profile's default model and thinking level immediately

#### Scenario: Selected profile default cannot be activated

- **WHEN** the user selects a profile whose default model cannot be activated
- **THEN** the system still records the selected profile as active
- **AND** the system leaves the current model and thinking level unchanged
- **AND** the system shows a warning notification in the Pi UI

### Requirement: Persistent active model profile

The system SHALL persist the active model profile globally in user state so it survives Pi restarts and extension reloads.

#### Scenario: Active profile is loaded

- **WHEN** the extension starts and a persisted active profile exists
- **THEN** the system uses the persisted profile as the active model profile

#### Scenario: Persisted profile is missing or invalid

- **WHEN** the extension starts and no valid persisted active profile exists
- **THEN** the system uses the configured fallback profile as the active model profile

## MODIFIED Requirements

### Requirement: Default session model routing

The system SHALL attempt to activate the active model profile's default model and thinking level when a Pi session starts for startup, new, resume, fork, or reload reasons.

#### Scenario: Startup session begins

- **WHEN** Pi emits `session_start` with reason `startup`
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: New session begins

- **WHEN** Pi emits `session_start` with reason `new`
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Existing session resumes

- **WHEN** Pi emits `session_start` with reason `resume`
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Forked session begins

- **WHEN** Pi emits `session_start` with reason `fork`
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Extension runtime reloads

- **WHEN** Pi emits `session_start` with reason `reload`
- **THEN** the system attempts to activate the active model profile's default model and thinking level

### Requirement: Default model routing failure notification

The system SHALL notify the user with a warning when the active model profile's default model cannot be activated.

#### Scenario: Default model activation fails

- **WHEN** the system cannot activate the active model profile's default model
- **THEN** the system leaves the current model and thinking level unchanged
- **AND** the system shows a warning notification in the Pi UI

### Requirement: Temporary model and thinking routing

For a routed slash command, the system SHALL attempt to activate the command's route from the active model profile and apply that route's thinking level only if the configured model activates successfully.

#### Scenario: Routed model activates successfully

- **WHEN** a routed slash command is submitted and its route from the active model profile can be activated
- **THEN** the system uses that route's model and thinking level for that prompt execution

#### Scenario: Routed model cannot be activated

- **WHEN** a routed slash command is submitted and its route from the active model profile cannot be activated
- **THEN** the system leaves the current model and thinking level unchanged and continues processing the prompt

### Requirement: Temporary routing failure notification

The system SHALL notify the user with a warning when a routed slash command's route from the active model profile cannot be activated.

#### Scenario: Routed model activation fails

- **WHEN** the system cannot activate the route from the active model profile for a routed slash command
- **THEN** the system shows a warning notification in the Pi UI

### Requirement: State restoration after temporary route

After a temporarily routed slash command finishes, the system SHALL activate the active model profile's default model and thinking level.

#### Scenario: Routed slash command completes

- **WHEN** a routed slash command reaches the end of its agent execution
- **THEN** the system activates the active model profile's default model and thinking level

#### Scenario: User state changes during routed slash command

- **WHEN** the active model or thinking level changes while a routed slash command is executing
- **THEN** the system still activates the active model profile's default model and thinking level when the routed slash command reaches the end of its agent execution
