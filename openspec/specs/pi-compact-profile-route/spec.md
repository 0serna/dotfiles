## Purpose

Define how the optional `compact` profile route selects a dedicated model and thinking level for Pi context compaction, with fallback to default compaction when the route is absent, invalid, or fails at runtime.

## Requirements

### Requirement: Optional compact profile route

The system SHALL use an optional `compact` profile route to select the model and thinking level for Pi context compaction.

#### Scenario: Compact route is configured and valid

- **WHEN** Pi emits `session_before_compact`
- **AND** the persisted profile configuration contains a valid `compact` route
- **THEN** the system uses the compact route's model and thinking level to generate the compaction result
- **AND** the system does not change the user's active model

#### Scenario: Compact route is absent

- **WHEN** Pi emits `session_before_compact`
- **AND** the persisted profile configuration does not contain a `compact` route
- **THEN** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior

#### Scenario: Compact route is invalid

- **WHEN** Pi emits `session_before_compact`
- **AND** the persisted profile configuration contains an unusable `compact` route
- **THEN** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior
- **AND** the system does not show a warning for the invalid compact route

### Requirement: Compact route fallback on runtime failure

The system SHALL fall back to Pi default compaction when a configured compact route cannot be used at compaction time.

#### Scenario: Compact route model or auth fails at runtime

- **WHEN** Pi emits `session_before_compact`
- **AND** the system attempts to use a configured `compact` route
- **AND** the route model, authentication, or compaction request fails
- **THEN** the system shows a warning for the failed compact route
- **AND** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior

### Requirement: Compact route applies to all compaction triggers

The system SHALL apply the optional `compact` route to manual, threshold, and overflow compaction.

#### Scenario: Manual compaction runs

- **WHEN** the user invokes `/compact`
- **AND** a valid `compact` route is configured
- **THEN** the system uses the `compact` route for the compaction request

#### Scenario: Automatic compaction runs

- **WHEN** Pi starts threshold or overflow compaction
- **AND** a valid `compact` route is configured
- **THEN** the system uses the `compact` route for the compaction request
