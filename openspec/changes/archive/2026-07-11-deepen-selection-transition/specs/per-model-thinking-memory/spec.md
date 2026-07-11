## MODIFIED Requirements

### Requirement: Persist thinking level per model

The system SHALL persist the last manually selected thinking level for each model so the preference survives Pi restarts. Automatic thinking-level changes caused by a model transition, route activation, route restoration, or session-start restoration MUST NOT be recorded as manual preferences.

#### Scenario: User changes thinking level while a model is active

- **WHEN** Pi emits `thinking_level_select`
- **AND** an active model is available
- **AND** the change was not caused by a model transition, route activation, route restoration, or session-start restoration
- **THEN** the system records the selected thinking level for that model

#### Scenario: Model transition emits an automatic clamp

- **WHEN** Pi emits `thinking_level_select` before the corresponding `model_select` while changing models
- **AND** the active model identity differs from the last active model identity
- **THEN** the system does not record the clamped level as the user's preference for either model

#### Scenario: Extension restarts

- **WHEN** persisted per-model thinking memory exists
- **THEN** the system loads the persisted memory for future model selections

### Requirement: Restore remembered thinking on manual model selection

The system SHALL restore a model's remembered thinking level when the user manually selects or cycles to that model, after Pi has completed the model selection transition.

#### Scenario: User sets a model with remembered thinking

- **WHEN** Pi emits `model_select` with source `set`
- **AND** the selected model has a remembered thinking level
- **THEN** the system applies that remembered thinking level

#### Scenario: User cycles to a model with remembered thinking

- **WHEN** Pi emits `model_select` with source `cycle`
- **AND** the selected model has a remembered thinking level
- **THEN** the system applies that remembered thinking level

#### Scenario: User returns to a model after Pi clamps the current level

- **WHEN** Pi emits an automatic thinking-level clamp before `model_select`
- **AND** the user completes a manual selection of a model with a remembered thinking level
- **THEN** the system applies the remembered level
- **AND** the automatic clamp does not replace the remembered level

#### Scenario: User selects a model without remembered thinking

- **WHEN** Pi emits `model_select` with source `set` or `cycle`
- **AND** the selected model has no remembered thinking level
- **THEN** the system leaves the current Pi thinking behavior unchanged

#### Scenario: Non-manual model selection occurs

- **WHEN** Pi emits `model_select` from a source other than `set` or `cycle`
- **THEN** the system does not restore per-model thinking memory
