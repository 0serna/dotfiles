## ADDED Requirements

### Requirement: Session baseline selection

The system SHALL maintain a non-persisted model and thinking-level pair owned by each Pi session runtime as its session baseline selection, initialize it from the selection supplied by Pi, and replace it after explicit manual selections.

#### Scenario: Session starts with a Pi selection

- **WHEN** Pi emits `session_start` for startup, reload, new, resume, or fork with a current model and thinking level
- **THEN** the system adopts that pair as the session baseline selection
- **AND** does not set the model or thinking level
- **AND** does not update persisted thinking memory

#### Scenario: Session starts without a model

- **WHEN** Pi emits `session_start` without a current model
- **THEN** the system leaves the session baseline selection unset
- **AND** captures Pi's current model and thinking level immediately before the first route activation if a model is then available

#### Scenario: User changes the session baseline

- **WHEN** the user manually selects a model or thinking level in a session
- **THEN** the system updates that session's baseline selection
- **AND** updates persisted thinking memory for the selected model

#### Scenario: Legacy preferences are loaded

- **WHEN** the persisted preferences contain a legacy `selection` and valid `thinkingMemory`
- **THEN** the system ignores the legacy selection
- **AND** retains the thinking memory
- **AND** writes the canonical thinking-memory-only format on the next manual preference change

## MODIFIED Requirements

### Requirement: Manual selection cancels active routing

The system SHALL treat an explicit manual model or thinking-level selection during an active route segment as cancellation of that route, SHALL make the resulting model and thinking-level pair the session baseline selection, and SHALL persist the resulting per-model thinking memory.

#### Scenario: User manually selects a model during routed work

- **WHEN** the user selects or cycles to a model during an active route segment
- **THEN** the route segment ends
- **AND** the selected model and resulting thinking level become the session baseline selection
- **AND** settled restoration does not replace that selection

#### Scenario: User manually selects a thinking level during routed work

- **WHEN** the user changes the thinking level during an active route segment
- **THEN** the route segment ends
- **AND** the routed model with the selected thinking level becomes the session baseline selection
- **AND** settled restoration does not replace that selection

#### Scenario: Automatic selection event occurs during routing

- **WHEN** a model or thinking-level event is caused by route activation, route restoration, or an automatic model clamp
- **THEN** the event does not cancel the active route
- **AND** does not overwrite the session baseline selection or persisted thinking memory

### Requirement: Route restoration waits for settled idle state

The system SHALL restore the current session's baseline selection after routed work only when Pi is settled and idle.

#### Scenario: Low-level attempt ends

- **WHEN** Pi emits `agent_end` during an active route segment
- **THEN** the system does not restore the session baseline selection

#### Scenario: Settlement is not idle

- **WHEN** Pi emits `agent_settled` during an active route segment
- **AND** `ctx.isIdle()` is false because another extension started work
- **THEN** the system keeps route restoration pending

#### Scenario: Routed work settles while idle

- **WHEN** Pi emits `agent_settled` during an active route segment
- **AND** `ctx.isIdle()` is true
- **THEN** the system restores the model and thinking level from the current session's baseline selection
- **AND** closes the active route

#### Scenario: Another session changes persisted thinking memory during routed work

- **WHEN** another Pi session changes shared persisted thinking memory while the current session has an active route segment
- **AND** the current session's routed work settles while idle
- **THEN** the current session restores its own baseline selection
- **AND** does not adopt a model or thinking level from the other session

#### Scenario: Session baseline selection cannot be restored

- **WHEN** routed work settles while idle
- **AND** the current session's baseline selection is missing, unknown, or cannot activate
- **THEN** the system retains the currently active model
- **AND** closes the active route
- **AND** warns when a configured selection cannot be restored

#### Scenario: Session shuts down with pending route state

- **WHEN** Pi emits `session_shutdown`
- **THEN** the system discards active and queued route state for the old session

## REMOVED Requirements

### Requirement: Session-owned manual selection

**Reason**: The persisted manual selection incorrectly overrides the model and thinking level already selected by Pi at every session-runtime boundary. Route restoration now uses a non-persisted session baseline selection instead.

**Migration**: Existing persisted `selection` fields are ignored; valid `thinkingMemory` is retained and the file is rewritten without `selection` after the next manual preference change.
