## Purpose

Enables configurable model routes where each declared command token can be assigned an independent model and thinking level, with validation against Pi's model registry.

## Requirements

### Requirement: Configurable model routes

The system SHALL persist automatic route configuration as a partial JSON object keyed by declared route tokens, where each configured value contains a model and thinking level. Unset routes SHALL be omitted.

#### Scenario: Partial route configuration exists

- **WHEN** persisted configuration contains usable values for some declared route tokens and omits others
- **THEN** the system treats each present usable route as configured
- **AND** treats each omitted route as unset

#### Scenario: Persisted route is malformed

- **WHEN** a parseable configuration contains a route value without a valid model and thinking level
- **THEN** the system converts that route to unset
- **AND** rewrites the canonical configuration at session start

#### Scenario: Persisted route is no longer declared

- **WHEN** a parseable configuration contains a key that is not a declared route token
- **THEN** the system removes that entry when canonicalizing or saving configuration

#### Scenario: Configuration file is unreadable

- **WHEN** the route configuration cannot be read or parsed
- **THEN** the system does not overwrite the file automatically
- **AND** disables automatic routes from that file
- **AND** warns the user

### Requirement: Available model selection and validation

The system SHALL present only models available to Pi for route selection and SHALL validate configured routes independently against Pi's model registry.

#### Scenario: User selects route model

- **WHEN** the user edits a route model in `/model-routes`
- **THEN** the system lists models from Pi's available model set

#### Scenario: Persisted route references an unknown model

- **WHEN** a parseable configuration references a model unknown to Pi's model registry
- **THEN** the system converts only that route to unset
- **AND** preserves other usable routes

#### Scenario: Persisted route model temporarily lacks credentials

- **WHEN** a configured model is known to Pi's model registry
- **AND** the model currently lacks usable credentials
- **THEN** the system retains the persisted route configuration
- **AND** treats the route as unusable until credentials become available

### Requirement: Model-specific thinking-level selection

The system SHALL validate each configured route's thinking level against that route's selected model.

#### Scenario: User selects route thinking level

- **WHEN** the user edits a route after selecting a model
- **THEN** the system presents only thinking levels supported by that model

#### Scenario: Persisted thinking level is unsupported

- **WHEN** a parseable route references a thinking level unsupported by its model
- **THEN** the system converts only that route to unset
- **AND** preserves other usable routes

### Requirement: Manual setup for missing configuration

The system SHALL keep `/model-routes` available when route configuration is missing and SHALL allow partial configuration.

#### Scenario: Configuration is missing

- **WHEN** the user invokes `/model-routes` and no persisted route configuration exists
- **THEN** the system opens the editor with every declared route shown as unset

#### Scenario: Setup remains partial

- **WHEN** the user configures only some declared routes
- **THEN** the system allows the partial configuration to be saved
- **AND** leaves the remaining routes unset

### Requirement: Route editor navigation

The `/model-routes` command SHALL open the route editor directly and allow each declared route to be configured or unset independently.

#### Scenario: User opens route editor

- **WHEN** the user invokes `/model-routes`
- **THEN** the system shows one row for every declared route token in declaration order
- **AND** shows omitted routes as `[unset]`

#### Scenario: User edits selected route

- **WHEN** the user selects a route and chooses to edit it
- **THEN** the system prompts for an available model
- **AND** then prompts for a thinking level supported by that model
- **AND** returns to the route editor after both selections

#### Scenario: User unsets selected route

- **WHEN** the user chooses to unset a configured route
- **THEN** the editor displays that route as `[unset]`
- **AND** the saved JSON omits its key

### Requirement: Save behavior for edited routes

The system SHALL persist only configured, declared routes and SHALL allow any number of routes to remain unset.

#### Scenario: Configuration is saved

- **WHEN** the user saves from `/model-routes`
- **THEN** the system writes configured declared routes
- **AND** omits unset routes
- **AND** removes undeclared entries
- **AND** does not activate any route after saving
