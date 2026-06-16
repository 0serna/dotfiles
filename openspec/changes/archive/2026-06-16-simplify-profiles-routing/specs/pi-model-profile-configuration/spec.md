## MODIFIED Requirements

### Requirement: Configurable fixed model routes

The system SHALL support manual configuration for a single profile containing `light` and `high` routes with a model and thinking level. The configuration SHALL be persisted as a flat JSON object with `light` and `high` keys.

#### Scenario: Complete route configuration exists

- **WHEN** persisted configuration contains `light` and `high` routes
- **AND** each route contains a valid model and thinking level
- **THEN** the system treats the configuration as complete

#### Scenario: Route configuration is incomplete

- **WHEN** persisted configuration omits a route, or omits a route model or thinking level
- **THEN** the system treats the configuration as invalid

### Requirement: Save behavior for edited routes

The system SHALL persist edited configuration only when the resulting full configuration is valid.

#### Scenario: Configuration is saved

- **WHEN** the user saves valid changes
- **THEN** the system persists the configuration
- **AND** does not activate any route after saving
