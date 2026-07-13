## Purpose

Routes declared slash commands to their configured model and thinking level at runtime, enabling different commands to use different models independently.

## Requirements

### Requirement: Disabled routing without usable route configuration

The system SHALL evaluate automatic routing independently for each declared route and SHALL leave other usable routes enabled when one route is absent or unusable.

#### Scenario: Session starts with partial configuration

- **WHEN** Pi emits `session_start` and only some declared routes have usable configuration
- **THEN** the system keeps the usable routes enabled
- **AND** does not activate any absent or unusable route

#### Scenario: Slash command has no usable route

- **WHEN** the user submits a declared slash command whose route is absent or unusable
- **THEN** the system warns that the route cannot be used
- **AND** Pi continues processing the input with its current model and thinking level

#### Scenario: Unusable route does not affect another route

- **WHEN** one declared route is absent or unusable
- **AND** another declared route has usable configuration
- **THEN** the system can route the command associated with the usable route

### Requirement: Temporary model and thinking routing

For a routed slash command, the system SHALL attempt to activate the model and thinking level configured directly for that command token.

#### Scenario: Routed model activates successfully

- **WHEN** a declared slash command is submitted
- **AND** that token has usable model and thinking-level configuration
- **AND** its model activates successfully
- **THEN** the system uses that model and thinking level for that prompt execution

#### Scenario: Routed model cannot be activated

- **WHEN** a declared slash command is submitted
- **AND** its configured model cannot be activated
- **THEN** the system warns that the route cannot be used
- **AND** leaves the current model and thinking level unchanged
- **AND** continues processing the prompt

### Requirement: Interactive route configuration

The system SHALL provide a `/model-routes` command that opens an editor listing every declared route token directly.

#### Scenario: User opens /model-routes

- **WHEN** the user invokes `/model-routes`
- **THEN** the system opens the route editor directly
- **AND** lists each declared route token
- **AND** does not show shared profile categories

#### Scenario: User edits route

- **WHEN** the user selects a route in the editor and presses `Enter`
- **THEN** the system prompts for that route's model and thinking level

#### Scenario: User saves partial configuration

- **WHEN** any configured routes are valid
- **AND** zero or more declared routes are unset
- **AND** the user saves from the route editor
- **THEN** the system persists the configured routes
- **AND** does not activate any route after saving
