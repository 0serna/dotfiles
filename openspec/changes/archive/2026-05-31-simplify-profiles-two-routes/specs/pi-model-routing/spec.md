## MODIFIED Requirements

### Requirement: Disabled routing without valid configuration

The system SHALL disable automatic routing behavior when persisted configuration is missing or invalid.

#### Scenario: Session starts without valid configuration

- **WHEN** Pi emits `session_start` and no valid configuration is available
- **THEN** the system does not attempt to activate a default model or thinking level

#### Scenario: Slash command is submitted without valid configuration

- **WHEN** the user submits a configured slash command and no valid configuration is available
- **THEN** the system does not apply temporary model routing
- **AND** Pi continues processing the input with its current model and thinking level behavior

#### Scenario: Routed command restore is considered without valid configuration

- **WHEN** configuration is not valid
- **THEN** the system does not attempt to restore a default model or thinking level after agent execution

### Requirement: Default session model routing

The system SHALL attempt to activate the `default` route model and thinking level when a Pi session starts for startup, new, resume, fork, or reload reasons only when valid configuration is available.

#### Scenario: Startup session begins

- **WHEN** Pi emits `session_start` with reason `startup`
- **AND** valid configuration is available
- **THEN** the system attempts to activate the `default` route model and thinking level

#### Scenario: New session begins

- **WHEN** Pi emits `session_start` with reason `new`
- **AND** valid configuration is available
- **THEN** the system attempts to activate the `default` route model and thinking level

#### Scenario: Existing session resumes

- **WHEN** Pi emits `session_start` with reason `resume`
- **AND** valid configuration is available
- **THEN** the system attempts to activate the `default` route model and thinking level

#### Scenario: Forked session begins

- **WHEN** Pi emits `session_start` with reason `fork`
- **AND** valid configuration is available
- **THEN** the system attempts to activate the `default` route model and thinking level

#### Scenario: Extension runtime reloads

- **WHEN** Pi emits `session_start` with reason `reload`
- **AND** valid configuration is available
- **THEN** the system attempts to activate the `default` route model and thinking level

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

After a temporarily routed slash command finishes, the system SHALL activate the `default` route model and thinking level only when valid configuration remains available.

#### Scenario: Routed slash command completes

- **WHEN** a routed slash command reaches the end of its agent execution
- **AND** valid configuration is available
- **THEN** the system activates the `default` route model and thinking level

#### Scenario: User state changes during routed slash command

- **WHEN** the active model or thinking level changes while a routed slash command is executing
- **AND** valid configuration is available when the routed slash command reaches the end of its agent execution
- **THEN** the system still activates the `default` route model and thinking level

### Requirement: Named model routes

The system SHALL support a configuration defining a `default` route and a `high` route.

#### Scenario: Configuration supplies default route

- **WHEN** the system needs the default route
- **AND** valid configuration is available
- **THEN** the system uses the configured `default` route

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
- **AND** activates the `default` route

### Requirement: Persistent configuration

The system SHALL persist the configuration to disk so it survives Pi restarts and extension reloads.

#### Scenario: Configuration is loaded

- **WHEN** the extension starts and persisted configuration is valid
- **THEN** the system uses the persisted routes

#### Scenario: Persisted configuration is missing or invalid

- **WHEN** the extension starts and no valid persisted configuration exists
- **THEN** routing behavior remains disabled until the user saves valid configuration

## REMOVED Requirements

### Requirement: Compaction triggers low-model routing

**Reason**: Compaction no longer triggers model switching. Compaction uses whatever model is active.

**Migration**: No replacement needed; compaction proceeds with current model.

### Requirement: Restore pre-compaction model after compaction

**Reason**: No compaction-specific routing means no snapshot to restore.

**Migration**: No replacement needed.

### Requirement: Model profile status in footer

**Reason**: Status bar reporting removed to reduce complexity.

**Migration**: No replacement needed; Pi's built-in model indicator suffices.

### Requirement: Interactive model profile selection

**Reason**: Single profile model eliminates profile selection. Route editor is opened directly.

**Migration**: Route configuration via `/profile` replaces profile selection.
