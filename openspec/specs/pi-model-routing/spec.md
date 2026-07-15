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

For a routed slash command, the system SHALL apply the configured model and thinking level as a route segment that begins when that command starts processing and remains active across retries, compaction recovery, and unrouted continuations until another route starts, a manual selection cancels it, or the processing cycle finishes.

#### Scenario: Routed model activates successfully

- **WHEN** a declared slash command is submitted while Pi is idle
- **AND** that token has usable model and thinking-level configuration
- **AND** its model activates successfully
- **THEN** the system activates the route before the command's first agent attempt

#### Scenario: Unrouted follow-up inherits active route

- **WHEN** a follow-up without a declared route is queued during an active route segment
- **THEN** the follow-up uses the active route's model and thinking level

#### Scenario: Queued route waits for its message boundary

- **WHEN** a declared routed command is submitted while Pi is processing another message
- **THEN** the system does not change models when the input is received
- **AND** activates the new route when that queued user message begins processing

#### Scenario: Queued route activates successfully

- **WHEN** a queued routed user message begins processing
- **AND** its configured model and thinking level activate successfully
- **THEN** the new route segment replaces the previous route segment

#### Scenario: Queued route cannot activate

- **WHEN** a queued routed user message begins processing
- **AND** its configured route cannot activate
- **THEN** the system warns that the route cannot be used
- **AND** continues with the previously active model and thinking level

#### Scenario: Routed attempt requires automatic retry

- **WHEN** an attempt in an active route segment ends with a retryable error
- **THEN** the route remains active for the automatic retry
- **AND** restoration does not occur at `agent_end`

#### Scenario: Routed attempt requires default compaction recovery

- **WHEN** an attempt in an active route segment requires automatic compaction
- **AND** no usable `/compact` route supplies a custom result
- **THEN** Pi's default compaction uses the active routed model
- **AND** the route remains active for any recovery attempt

#### Scenario: Routed model cannot be activated

- **WHEN** a declared slash command reaches its activation boundary
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
