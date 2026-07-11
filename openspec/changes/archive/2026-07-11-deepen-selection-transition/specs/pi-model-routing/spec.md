## MODIFIED Requirements

### Requirement: User changes thinking level

The system SHALL persist an active model and manually selected thinking level as the user's manual preference for future sessions and other Pi instances, and SHALL update that model's per-model thinking memory in the same persisted preference snapshot. Automatic model-transition clamps, route activation, route restoration, and session-start restoration MUST NOT update that snapshot.

#### Scenario: User changes thinking level manually

- **WHEN** Pi emits `thinking_level_select` while an active model is available
- **AND** the event is not an automatic model-switch clamp
- **AND** the event is not caused by route activation, route restoration, or session-start restoration
- **THEN** the system persists the active model and selected thinking level as the user's manual preference
- **AND** the system records the selected level for that model

#### Scenario: Automatic model-switch clamp occurs

- **WHEN** a manual model switch causes Pi to emit `thinking_level_select` before its corresponding `model_select`
- **AND** the active model identity differs from the last active model identity
- **THEN** the system does not persist the clamped level as the user's manual preference
- **AND** the system does not replace that model's remembered thinking level with the clamped level
