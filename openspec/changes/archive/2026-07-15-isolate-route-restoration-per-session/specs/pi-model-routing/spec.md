## ADDED Requirements

### Requirement: Session-owned manual selection

The system SHALL maintain a model and thinking-level pair owned by each Pi session runtime, initialize it from manual preferences at `session_start`, and publish subsequent manual changes to shared preferences without adopting changes published by other active sessions.

#### Scenario: Session starts with persisted manual selection

- **WHEN** Pi emits `session_start` with a restorable persisted manual selection
- **THEN** the system restores that model and thinking level
- **AND** adopts the pair as the session's manual selection

#### Scenario: User changes the manual selection

- **WHEN** the user manually selects a model or thinking level in a session
- **THEN** the system updates that session's manual selection
- **AND** persists the resulting model and thinking-level pair for future sessions

#### Scenario: Another session publishes a manual selection

- **WHEN** another active Pi session changes the shared persisted manual selection
- **THEN** the current session retains its own manual selection in memory

#### Scenario: Session runtime is replaced

- **WHEN** Pi replaces the session runtime and emits a new `session_start`
- **THEN** the new runtime initializes its manual selection from the latest shared preferences

## MODIFIED Requirements

### Requirement: Route restoration waits for settled idle state

The system SHALL restore the current session's manual selection after routed work only when Pi is settled and idle.

#### Scenario: Low-level attempt ends

- **WHEN** Pi emits `agent_end` during an active route segment
- **THEN** the system does not restore the manual selection

#### Scenario: Settlement is not idle

- **WHEN** Pi emits `agent_settled` during an active route segment
- **AND** `ctx.isIdle()` is false because another extension started work
- **THEN** the system keeps route restoration pending

#### Scenario: Routed work settles while idle

- **WHEN** Pi emits `agent_settled` during an active route segment
- **AND** `ctx.isIdle()` is true
- **THEN** the system restores the model and thinking level from the current session's manual selection
- **AND** closes the active route

#### Scenario: Another session changes persisted preferences during routed work

- **WHEN** another Pi session changes the shared persisted manual selection while the current session has an active route segment
- **AND** the current session's routed work settles while idle
- **THEN** the current session restores its own manual selection
- **AND** does not adopt the other session's model or thinking level

#### Scenario: Session manual selection cannot be restored

- **WHEN** routed work settles while idle
- **AND** the current session's manual selection is missing, unknown, or cannot activate
- **THEN** the system retains the currently active model
- **AND** closes the active route
- **AND** warns when a configured selection cannot be restored

#### Scenario: Session shuts down with pending route state

- **WHEN** Pi emits `session_shutdown`
- **THEN** the system discards active and queued route state for the old session
