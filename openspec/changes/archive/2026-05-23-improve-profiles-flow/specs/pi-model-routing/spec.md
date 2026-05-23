## MODIFIED Requirements

### Requirement: Interactive model profile selection

The system SHALL provide a `/model-profile` command that lets the user edit profile configuration as the primary profile-list action, explicitly activate the selected profile when valid profile configuration is available, and set up or repair profile configuration when valid profile configuration is not available.

#### Scenario: User edits model profile

- **WHEN** the user invokes `/model-profile`
- **AND** selects a profile in the profile list
- **AND** presses `Enter`
- **THEN** the system opens the selected profile for editing
- **AND** does not change the active profile
- **AND** does not apply profile routing behavior

#### Scenario: User activates model profile

- **WHEN** the user invokes `/model-profile` with valid profile configuration available
- **AND** selects a profile in the profile list
- **AND** presses `Space`
- **THEN** the system records the selected profile as active
- **AND** the system attempts to activate the selected profile's low model and thinking level immediately
- **AND** the system shows concise success feedback when activation succeeds

#### Scenario: Selected profile low cannot be activated

- **WHEN** the user selects a profile whose low model cannot be activated
- **THEN** the system still records the selected profile as active
- **AND** the system leaves the current model and thinking level unchanged
- **AND** the system shows a warning notification in the Pi UI

#### Scenario: User opens model profile command without valid configuration

- **WHEN** the user invokes `/model-profile` without valid profile configuration available
- **THEN** the system opens a setup or repair interface instead of applying profile routing behavior
- **AND** the system does not show an additional warning notification for opening the command

#### Scenario: User attempts activation without valid configuration

- **WHEN** the user invokes `/model-profile` without valid profile configuration available
- **AND** presses `Space` in the profile list
- **THEN** the system does not apply profile routing behavior
- **AND** the system shows a concise warning that a valid configuration is required before activation
