## MODIFIED Requirements

### Requirement: Configurable fixed model routes

The system SHALL support manual configuration for a single profile containing `default` and `high` routes with a model and thinking level. The configuration SHALL be persisted as a flat JSON object with `default` and `high` keys.

#### Scenario: Complete route configuration exists

- **WHEN** persisted configuration contains `default` and `high` routes
- **AND** each route contains a valid model and thinking level
- **THEN** the system treats the configuration as complete

#### Scenario: Route configuration is incomplete

- **WHEN** persisted configuration omits a route, or omits a route model or thinking level
- **THEN** the system treats the configuration as invalid

### Requirement: Available model selection

The system SHALL present only models available to Pi for selection when configuring a route model.

#### Scenario: User selects route model

- **WHEN** the user edits a route model in `/profile`
- **THEN** the system lists models from Pi's available model set

#### Scenario: Persisted model is unavailable

- **WHEN** persisted configuration references a model that is not available to Pi
- **THEN** the system treats the configuration as invalid

### Requirement: Model-specific thinking-level selection

The system SHALL validate each route thinking level against the selected model's supported thinking levels.

#### Scenario: User selects route thinking level

- **WHEN** the user edits a route thinking level after selecting a model
- **THEN** the system presents only thinking levels supported by that selected model

#### Scenario: Persisted thinking level is unsupported

- **WHEN** persisted configuration references a thinking level that is not supported by the route model
- **THEN** the system treats the configuration as invalid

### Requirement: Manual setup for missing configuration

The system SHALL keep `/profile` available when configuration is missing and SHALL allow the user to create a complete configuration manually.

#### Scenario: Configuration is missing

- **WHEN** the user invokes `/profile` and no persisted configuration exists
- **THEN** the system opens a setup interface with the routes shown as unset

#### Scenario: Setup is incomplete

- **WHEN** the user has not selected a model and thinking level for every route
- **THEN** the system does not persist the setup draft as active configuration

#### Scenario: Setup is complete and valid

- **WHEN** the user completes all routes with available models and supported thinking levels
- **THEN** the system allows the configuration to be saved

### Requirement: Repair mode for invalid configuration

The system SHALL keep `/profile` available when configuration is invalid and SHALL allow the user to repair invalid values.

#### Scenario: Invalid configuration is opened

- **WHEN** the user invokes `/profile` while persisted configuration is invalid
- **THEN** the system opens a repair interface
- **AND** shows recoverable configured values
- **AND** marks invalid or missing values visibly

#### Scenario: Invalid values are repaired

- **WHEN** the user replaces invalid or missing values with available models and supported thinking levels for all routes
- **THEN** the system allows the repaired configuration to be saved

### Requirement: Route editor navigation

The `/profile` command SHALL open the route editor directly without profile selection. The editor SHALL allow editing each route's model and thinking level.

#### Scenario: User opens /profile

- **WHEN** the user invokes `/profile`
- **THEN** the system opens the route editor directly
- **AND** does not show a profile selection screen

#### Scenario: User edits selected route

- **WHEN** the user selects a route in the route editor and presses `Enter`
- **THEN** the system prompts for the route model
- **AND** then prompts for the route thinking level supported by that model
- **AND** returns to the route editor after both selections are complete

#### Scenario: User saves from route editor

- **WHEN** all routes have a selected model and thinking level
- **AND** the user presses `Esc` in the route editor
- **THEN** the system saves the configuration

#### Scenario: User attempts to save incomplete route editor

- **WHEN** one or more routes have no selected model
- **AND** the user presses `Esc` in the route editor
- **THEN** the system does not save the configuration
- **AND** remains in the route editor
- **AND** shows a concise warning listing the routes that must be completed before saving

### Requirement: Save behavior for edited routes

The system SHALL persist edited configuration only when the resulting full configuration is valid.

#### Scenario: Configuration is saved

- **WHEN** the user saves valid changes
- **THEN** the system persists the configuration
- **AND** activates the default route

### Requirement: Configuration warning cadence

The system SHALL notify the user when configuration is missing or invalid without warning repeatedly for every input.

#### Scenario: Missing or invalid configuration is detected for a session

- **WHEN** the system detects missing or invalid configuration during a session
- **THEN** it shows a warning at most once for that session

#### Scenario: User opens route editor while configuration is missing or invalid

- **WHEN** the user invokes `/profile` while configuration is missing or invalid
- **THEN** the system shows setup or repair state in the TUI
- **AND** does not show an additional warning notification for opening the command

## REMOVED Requirements

### Requirement: Profile manager keyboard actions

**Reason**: Single profile model eliminates profile selection. Route editor is opened directly.

**Migration**: Route editor navigation replaces profile list actions.

### Requirement: Profile manager status display

**Reason**: Single profile model eliminates profile list. Route editor is opened directly.

**Migration**: Status display removed; route editor shows configuration state directly.

### Requirement: Model profile footer status

**Reason**: Status bar reporting removed to reduce complexity. Pi's model indicator provides current model info.

**Migration**: No replacement needed; Pi's built-in model indicator suffices.
