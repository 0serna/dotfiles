## ADDED Requirements

### Requirement: Disabled routing without valid profile configuration

The system SHALL disable automatic model-profile routing behavior when persisted profile configuration is missing or invalid.

#### Scenario: Session starts without valid profile configuration

- **WHEN** Pi emits `session_start` and no valid profile configuration is available
- **THEN** the system does not attempt to activate a profile default model or thinking level

#### Scenario: Slash command is submitted without valid profile configuration

- **WHEN** the user submits a configured slash command and no valid profile configuration is available
- **THEN** the system does not apply temporary model routing
- **AND** Pi continues processing the input with its current model and thinking level behavior

#### Scenario: Routed command restore is considered without valid profile configuration

- **WHEN** profile configuration is not valid
- **THEN** the system does not attempt to restore a profile default model or thinking level after agent execution

## MODIFIED Requirements

### Requirement: Default session model routing

The system SHALL attempt to activate the active model profile's default model and thinking level when a Pi session starts for startup, new, resume, fork, or reload reasons only when valid profile configuration is available.

#### Scenario: Startup session begins

- **WHEN** Pi emits `session_start` with reason `startup`
- **AND** valid profile configuration is available
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: New session begins

- **WHEN** Pi emits `session_start` with reason `new`
- **AND** valid profile configuration is available
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Existing session resumes

- **WHEN** Pi emits `session_start` with reason `resume`
- **AND** valid profile configuration is available
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Forked session begins

- **WHEN** Pi emits `session_start` with reason `fork`
- **AND** valid profile configuration is available
- **THEN** the system attempts to activate the active model profile's default model and thinking level

#### Scenario: Extension runtime reloads

- **WHEN** Pi emits `session_start` with reason `reload`
- **AND** valid profile configuration is available
- **THEN** the system attempts to activate the active model profile's default model and thinking level

### Requirement: Temporary model and thinking routing

For a routed slash command, the system SHALL attempt to activate the command's route from the active model profile and apply that route's thinking level only when valid profile configuration is available and the configured model activates successfully.

#### Scenario: Routed model activates successfully

- **WHEN** a routed slash command is submitted
- **AND** valid profile configuration is available
- **AND** its route from the active model profile can be activated
- **THEN** the system uses that route's model and thinking level for that prompt execution

#### Scenario: Routed model cannot be activated

- **WHEN** a routed slash command is submitted
- **AND** valid profile configuration is available
- **AND** its route from the active model profile cannot be activated
- **THEN** the system leaves the current model and thinking level unchanged and continues processing the prompt

### Requirement: State restoration after temporary route

After a temporarily routed slash command finishes, the system SHALL activate the active model profile's default model and thinking level only when valid profile configuration remains available.

#### Scenario: Routed slash command completes

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** valid profile configuration is available
- **THEN** the system activates the active model profile's default model and thinking level

#### Scenario: User state changes during routed slash command

- **WHEN** the active model or thinking level changes while a routed slash command is executing
- **AND** valid profile configuration is available when the routed slash command reaches the end of its agent execution
- **THEN** the system still activates the active model profile's default model and thinking level

### Requirement: Named model profiles

The system SHALL support fixed named model profiles where each configured profile defines a default route, a light route, and a heavy route.

#### Scenario: Active profile supplies default route

- **WHEN** the system needs the default route
- **AND** valid profile configuration is available
- **THEN** the system uses the configured default route from the active model profile

#### Scenario: Active profile supplies temporary route

- **WHEN** a routed slash command maps to a light or heavy route
- **AND** valid profile configuration is available
- **THEN** the system uses that configured route from the active model profile

### Requirement: Interactive model profile selection

The system SHALL provide a `/model-profile` command that lets the user select the active model profile interactively when valid profile configuration is available, and lets the user set up or repair profile configuration when valid profile configuration is not available.

#### Scenario: User selects model profile

- **WHEN** the user invokes `/model-profile` with valid profile configuration available and selects a profile for activation
- **THEN** the system records the selected profile as active
- **AND** the system attempts to activate the selected profile's default model and thinking level immediately

#### Scenario: Selected profile default cannot be activated

- **WHEN** the user selects a profile whose default model cannot be activated
- **THEN** the system still records the selected profile as active
- **AND** the system leaves the current model and thinking level unchanged
- **AND** the system shows a warning notification in the Pi UI

#### Scenario: User opens model profile command without valid configuration

- **WHEN** the user invokes `/model-profile` without valid profile configuration available
- **THEN** the system opens a setup or repair interface instead of applying profile routing behavior
- **AND** the system does not show an additional warning notification for opening the command

### Requirement: Model profile status in footer

The system SHALL publish model-profile state through Pi extension status so the footer can display it before the active model information.

#### Scenario: Footer displays profile before model

- **WHEN** the custom Pi footer renders extension statuses
- **AND** the `model-profile` status is present
- **THEN** the footer displays that status after the current directory/branch section
- **AND** before the active model and thinking-level section

#### Scenario: Temporary routing does not change profile status

- **WHEN** a routed slash command temporarily changes the active model and thinking level
- **THEN** the system keeps the `model-profile` footer status unchanged

### Requirement: Persistent active model profile

The system SHALL persist the active model profile as part of the persisted profile configuration so it survives Pi restarts and extension reloads.

#### Scenario: Active profile is loaded

- **WHEN** the extension starts and persisted profile configuration is valid
- **THEN** the system uses the persisted active profile as the active model profile

#### Scenario: Persisted profile is missing or invalid

- **WHEN** the extension starts and no valid persisted profile configuration exists
- **THEN** the system does not select a fallback profile
- **AND** model-profile routing behavior remains disabled until the user saves valid profile configuration
