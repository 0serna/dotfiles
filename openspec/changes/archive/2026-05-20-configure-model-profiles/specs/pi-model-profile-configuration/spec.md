## ADDED Requirements

### Requirement: Configurable fixed model profiles

The system SHALL support manual configuration for the fixed model profiles `mixed` and `opencode`, and each profile SHALL contain `default`, `light`, and `heavy` routes with a model and thinking level.

#### Scenario: Complete profile configuration exists

- **WHEN** persisted profile configuration contains both fixed profiles
- **AND** each fixed profile contains `default`, `light`, and `heavy` routes
- **AND** each route contains a valid model and thinking level
- **THEN** the system treats the profile configuration as complete

#### Scenario: Profile configuration is incomplete

- **WHEN** persisted profile configuration omits a fixed profile, omits a fixed route, or omits a route model or thinking level
- **THEN** the system treats the profile configuration as invalid

### Requirement: Available model selection

The system SHALL present only models available to Pi for selection when configuring a profile route model.

#### Scenario: User selects route model

- **WHEN** the user edits a route model in `/model-profile`
- **THEN** the system lists models from Pi's available model set

#### Scenario: Persisted model is unavailable

- **WHEN** persisted profile configuration references a model that is not available to Pi
- **THEN** the system treats the profile configuration as invalid

### Requirement: Model-specific thinking-level selection

The system SHALL validate each route thinking level against the selected model's supported thinking levels.

#### Scenario: User selects route thinking level

- **WHEN** the user edits a route thinking level after selecting a model
- **THEN** the system presents only thinking levels supported by that selected model

#### Scenario: Persisted thinking level is unsupported

- **WHEN** persisted profile configuration references a thinking level that is not supported by the route model
- **THEN** the system treats the profile configuration as invalid

### Requirement: Manual setup for missing configuration

The system SHALL keep `/model-profile` available when profile configuration is missing and SHALL allow the user to create a complete configuration manually.

#### Scenario: Configuration is missing

- **WHEN** the user invokes `/model-profile` and no persisted profile configuration exists
- **THEN** the system opens a setup interface with the fixed profiles and routes shown as unset

#### Scenario: Setup is incomplete

- **WHEN** the user has not selected a model and thinking level for every fixed route
- **THEN** the system does not persist the setup draft as active profile configuration

#### Scenario: Setup is complete and valid

- **WHEN** the user completes all fixed routes with available models and supported thinking levels
- **THEN** the system allows the configuration to be saved

### Requirement: Repair mode for invalid configuration

The system SHALL keep `/model-profile` available when profile configuration is invalid and SHALL allow the user to repair invalid values.

#### Scenario: Invalid configuration is opened

- **WHEN** the user invokes `/model-profile` while persisted profile configuration is invalid
- **THEN** the system opens a repair interface
- **AND** shows recoverable configured values
- **AND** marks invalid or missing values visibly

#### Scenario: Invalid values are repaired

- **WHEN** the user replaces invalid or missing values with available models and supported thinking levels for all fixed routes
- **THEN** the system allows the repaired configuration to be saved

### Requirement: Profile manager keyboard actions

The `/model-profile` interface SHALL allow the user to activate or edit profiles from the profile list using distinct keyboard actions.

#### Scenario: User activates selected profile

- **WHEN** the user selects a profile in `/model-profile` and confirms activation
- **THEN** the system records that profile as active
- **AND** attempts to activate that profile's default route immediately

#### Scenario: User edits selected profile

- **WHEN** the user selects a profile in `/model-profile` and chooses the edit action
- **THEN** the system opens the editor for that selected profile without changing the active profile

### Requirement: Save behavior for edited profiles

The system SHALL persist edited profile configuration only when the resulting full configuration is valid.

#### Scenario: Active profile is edited and saved

- **WHEN** the user saves valid changes to the active profile
- **THEN** the system persists the configuration
- **AND** refreshes the active profile by activating its configured default route

#### Scenario: Inactive profile is edited and saved

- **WHEN** the user saves valid changes to a profile that is not active
- **THEN** the system persists the configuration
- **AND** does not change the active profile
- **AND** does not change the current model or thinking level

### Requirement: Configuration warning cadence

The system SHALL notify the user when profile configuration is missing or invalid without warning repeatedly for every input.

#### Scenario: Missing or invalid configuration is detected for a session

- **WHEN** the system detects missing or invalid profile configuration during a session
- **THEN** it shows a warning at most once for that session

#### Scenario: User opens profile manager while configuration is missing or invalid

- **WHEN** the user invokes `/model-profile` while profile configuration is missing or invalid
- **THEN** the system shows setup or repair state in the TUI
- **AND** does not show an additional warning notification for opening the profile manager

### Requirement: Model profile footer status

The system SHALL publish the current model-profile state as a footer status instead of using informational notifications for normal activation or save events.

#### Scenario: Active profile status is shown

- **WHEN** valid profile configuration is loaded and the active profile default route is applied successfully
- **THEN** the system publishes `profile <name>` as the `model-profile` footer status
- **AND** the status uses dim styling

#### Scenario: Setup status is shown

- **WHEN** profile configuration is missing
- **THEN** the system publishes `profile setup` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Invalid status is shown

- **WHEN** profile configuration is invalid
- **THEN** the system publishes `profile invalid` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Failed status is shown

- **WHEN** valid profile configuration is available but the active profile default route cannot be activated
- **THEN** the system publishes `profile failed` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Informational profile notifications are suppressed

- **WHEN** a profile is activated or saved successfully
- **THEN** the system updates the footer status
- **AND** does not show an informational notification for the successful activation or save
