## MODIFIED Requirements

### Requirement: Configurable fixed model routes

The system SHALL support manual configuration for a single profile containing required `light` and `high` routes with a model and thinking level, and MAY contain an optional `compact` route with a model and thinking level. The configuration SHALL be persisted as a flat JSON object with `light` and `high` keys and an optional `compact` key.

#### Scenario: Complete route configuration exists

- **WHEN** persisted configuration contains `light` and `high` routes
- **AND** each required route contains a valid model and thinking level
- **THEN** the system treats the configuration as complete

#### Scenario: Route configuration is incomplete

- **WHEN** persisted configuration omits a required route, or omits a required route model or thinking level
- **THEN** the system treats the configuration as invalid

#### Scenario: Optional compact route is omitted

- **WHEN** persisted configuration contains valid `light` and `high` routes
- **AND** persisted configuration omits `compact`
- **THEN** the system treats the configuration as complete

### Requirement: Available model selection

The system SHALL present only models available to Pi for selection when configuring a route model.

#### Scenario: User selects route model

- **WHEN** the user edits a route model in `/profile`
- **THEN** the system lists models from Pi's available model set

#### Scenario: Persisted required-route model is unavailable

- **WHEN** persisted configuration references an unavailable model for `light` or `high`
- **THEN** the system treats the configuration as invalid

#### Scenario: Persisted compact-route model is unavailable

- **WHEN** persisted configuration references an unavailable model for `compact`
- **THEN** the system treats the compact route as unusable
- **AND** the system does not treat the required route configuration as invalid

### Requirement: Model-specific thinking-level selection

The system SHALL validate each route thinking level against the selected model's supported thinking levels.

#### Scenario: User selects route thinking level

- **WHEN** the user edits a route thinking level after selecting a model
- **THEN** the system presents only thinking levels supported by that selected model

#### Scenario: Persisted required-route thinking level is unsupported

- **WHEN** persisted configuration references an unsupported thinking level for `light` or `high`
- **THEN** the system treats the configuration as invalid

#### Scenario: Persisted compact-route thinking level is unsupported

- **WHEN** persisted configuration references an unsupported thinking level for `compact`
- **THEN** the system treats the compact route as unusable
- **AND** the system does not treat the required route configuration as invalid

### Requirement: Manual setup for missing configuration

The system SHALL keep `/profile` available when configuration is missing and SHALL allow the user to create a complete configuration manually.

#### Scenario: Configuration is missing

- **WHEN** the user invokes `/profile` and no persisted configuration exists
- **THEN** the system opens a setup interface with the routes shown as unset

#### Scenario: Setup is incomplete

- **WHEN** the user has not selected a model and thinking level for every required route
- **THEN** the system does not persist the setup draft as active configuration

#### Scenario: Setup is complete and valid

- **WHEN** the user completes all required routes with available models and supported thinking levels
- **THEN** the system allows the configuration to be saved

### Requirement: Repair mode for invalid configuration

The system SHALL keep `/profile` available when configuration is invalid and SHALL allow the user to repair invalid values.

#### Scenario: Invalid configuration is opened

- **WHEN** the user invokes `/profile` while persisted configuration is invalid
- **THEN** the system opens a repair interface
- **AND** shows recoverable configured values
- **AND** marks invalid or missing required-route values visibly

#### Scenario: Invalid values are repaired

- **WHEN** the user replaces invalid or missing values with available models and supported thinking levels for all required routes
- **THEN** the system allows the repaired configuration to be saved

### Requirement: Route editor navigation

The `/profile` command SHALL open the route editor directly without profile selection. The editor SHALL allow editing each route's model and thinking level and SHALL allow the optional `compact` route to be unset.

#### Scenario: User opens /profile

- **WHEN** the user invokes `/profile`
- **THEN** the system opens the route editor directly
- **AND** does not show a profile selection screen
- **AND** shows `light`, `high`, and `compact` route rows

#### Scenario: User edits selected route

- **WHEN** the user selects a route in the route editor and presses `Enter`
- **THEN** the system prompts for the route model
- **AND** then prompts for the route thinking level supported by that model
- **AND** returns to the route editor after both selections are complete

#### Scenario: User unsets compact route

- **WHEN** the user clears the `compact` route in the route editor
- **THEN** the system stores no `compact` route in the saved configuration

#### Scenario: User saves from route editor

- **WHEN** all required routes have a selected model and thinking level
- **AND** the user presses `Esc` in the route editor
- **THEN** the system saves the configuration

#### Scenario: User attempts to save incomplete route editor

- **WHEN** one or more required routes have no selected model
- **AND** the user presses `Esc` in the route editor
- **THEN** the system does not save the configuration
- **AND** remains in the route editor
- **AND** shows a concise warning listing the required routes that must be completed before saving

### Requirement: Save behavior for edited routes

The system SHALL persist edited configuration only when the resulting required route configuration is valid.

#### Scenario: Configuration is saved

- **WHEN** the user saves valid changes
- **THEN** the system persists the configuration
- **AND** does not activate any route after saving

#### Scenario: Configuration is saved without compact route

- **WHEN** the user saves valid required route changes
- **AND** the compact route is unset
- **THEN** the system persists the configuration without a `compact` route
