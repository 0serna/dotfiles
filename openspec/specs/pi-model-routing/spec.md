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

The system SHALL treat an explicit manual model or thinking-level selection during an active route segment as cancellation of that route and SHALL persist the resulting model and thinking-level pair as the manual selection.

#### Scenario: User manually selects a model during routed work

- **WHEN** the user selects or cycles to a model during an active route segment
- **THEN** the route segment ends
- **AND** the selected model and resulting thinking level become the manual selection
- **AND** settled restoration does not replace that selection

#### Scenario: User manually selects a thinking level during routed work

- **WHEN** the user changes the thinking level during an active route segment
- **THEN** the route segment ends
- **AND** the routed model with the selected thinking level becomes the manual selection
- **AND** settled restoration does not replace that selection

#### Scenario: Automatic selection event occurs during routing

- **WHEN** a model or thinking-level event is caused by route activation, route restoration, session-start restoration, or an automatic model clamp
- **THEN** the event does not cancel the active route
- **AND** does not overwrite the manual selection

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
