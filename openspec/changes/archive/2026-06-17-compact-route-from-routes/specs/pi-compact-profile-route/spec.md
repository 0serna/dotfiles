## ADDED Requirements

### Requirement: Compact route mapped to a named route

When `ROUTE_TYPES` declares a `/compact` mapping, the system SHALL select the model and thinking level for Pi context compaction by resolving that mapping to an existing named route and using that route's persisted model and thinking level to generate the compaction result. When `ROUTE_TYPES` does not declare a `/compact` mapping, the system SHALL not provide a custom compaction result, allowing Pi to use its default compaction behavior.

#### Scenario: Compact route is mapped and valid

- **WHEN** Pi emits `session_before_compact`
- **AND** the persisted profile configuration is valid
- **AND** `ROUTE_TYPES` contains a `/compact` mapping to a named route
- **THEN** the system resolves the `/compact` mapping from `ROUTE_TYPES` to that named route
- **AND** uses that named route's model and thinking level to generate the compaction result
- **AND** the system does not change the user's active model

#### Scenario: Compact route is not mapped

- **WHEN** Pi emits `session_before_compact`
- **AND** `ROUTE_TYPES` does not contain a `/compact` mapping
- **THEN** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior
- **AND** the system does not show a warning

#### Scenario: Configuration is missing or invalid

- **WHEN** Pi emits `session_before_compact`
- **AND** the persisted profile configuration is missing or invalid
- **THEN** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior

#### Scenario: Resolved route fails at runtime

- **WHEN** Pi emits `session_before_compact`
- **AND** `ROUTE_TYPES` contains a `/compact` mapping to a named route
- **AND** the mapped route's model, authentication, or compaction request fails
- **THEN** the system shows a warning for the failed compact route
- **AND** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior

## REMOVED Requirements

### Requirement: Optional compact profile route

**Reason**: The dedicated optional `compact` route is replaced by a `/compact` mapping in `ROUTE_TYPES` that targets an existing named route. Removing the `/compact` mapping now explicitly disables custom compact routing and restores Pi default compaction.

**Migration**: Remove any `compact` key from persisted `profiles.json`. Compaction now uses the route declared by `ROUTE_TYPES["/compact"]` (currently `high`). To use Pi default compaction, remove the `/compact` entry from `ROUTE_TYPES`.

### Requirement: Compact route fallback on runtime failure

**Reason**: Fallback semantics are folded into the new "Compact route mapped to a named route" requirement, which keeps runtime-failure fallback (model/auth/compaction failure) and defines the absent-`/compact` mapping case as intentional default compaction.

**Migration**: No action needed beyond the route mapping change; runtime failure of the named route still falls back to default compaction with a warning.

### Requirement: Compact route applies to all compaction triggers

**Reason**: Replaced by the "Compact route mapped to a named route" requirement, whose scenarios cover manual and automatic compaction triggers through the single `/compact` mapping when present.

**Migration**: No action needed; manual and automatic compaction both use the named route resolved from `ROUTE_TYPES["/compact"]` when present, or Pi default compaction when absent.
