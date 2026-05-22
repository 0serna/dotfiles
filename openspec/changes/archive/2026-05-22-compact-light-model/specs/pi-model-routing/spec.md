## MODIFIED Requirements

### Requirement: Temporary model and thinking routing

For a routed slash command, the system SHALL attempt to activate the command's route from the active model profile and apply that route's thinking level only when valid profile configuration is available and the configured model activates successfully. For compaction events, the system SHALL activate the `light` route under the same conditions, unless a command-based route is already in progress.

#### Scenario: Routed model activates successfully

- **WHEN** a routed slash command is submitted
- **AND** valid profile configuration is available
- **AND** its route from the active model profile can be activated
- **THEN** the system uses that route's model and thinking level for that prompt execution

#### Scenario: Routed model cannot be activated

- **WHEN** a routed slash command is submitted
- **AND** valid profile configuration is available
- **AND** its route from the active model profile cannot be activated
- **THEN** the system leaves the current model and thinking level unchanged and continues processing the prompt

#### Scenario: Compaction triggers with no active command route

- **WHEN** compaction triggers (manual or auto)
- **AND** valid profile configuration is available
- **AND** no command-based route snapshot is active
- **AND** the active profile's light model can be activated
- **THEN** the system uses the light model and thinking level for compaction summarization

#### Scenario: Compaction triggers with active command route

- **WHEN** compaction triggers (manual or auto)
- **AND** a command-based route snapshot is already active
- **THEN** the system does not change the model for compaction
- **AND** compaction proceeds with the current model
