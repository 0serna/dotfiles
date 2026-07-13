## Purpose

Provides a dedicated `/compact` route so Pi context compaction can use a configured model and thinking level independent of the user's active model.

## Requirements

### Requirement: Compact route configured directly

When `/compact` is declared and has usable independent route configuration, the system SHALL use that model and thinking level for both manual and automatic Pi context compaction. Otherwise the system SHALL allow Pi to use its default compaction behavior.

#### Scenario: Compact route is configured and usable

- **WHEN** Pi emits `session_before_compact`
- **AND** `/compact` is declared
- **AND** `/compact` has usable model and thinking-level configuration
- **THEN** the system uses that model and thinking level to generate the compaction result
- **AND** does not change the user's active model

#### Scenario: Compact route is not declared

- **WHEN** Pi emits `session_before_compact`
- **AND** `/compact` is not declared
- **THEN** the system does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior
- **AND** the system does not show a warning

#### Scenario: Compact route is unset or unusable

- **WHEN** Pi emits `session_before_compact`
- **AND** `/compact` is declared
- **AND** its route configuration is absent or unusable
- **THEN** the system warns that the compact route cannot be used
- **AND** does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior

#### Scenario: Compact request fails at runtime

- **WHEN** `/compact` has usable configuration
- **AND** authentication or the compaction request fails
- **THEN** the system shows a warning for the failed compact route
- **AND** does not provide a custom compaction result
- **AND** Pi uses its default compaction behavior
