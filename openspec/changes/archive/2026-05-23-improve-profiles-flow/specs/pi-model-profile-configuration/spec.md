## MODIFIED Requirements

### Requirement: Profile manager keyboard actions

The `/model-profile` interface SHALL allow the user to edit or activate profiles from the profile list using distinct keyboard actions, with editing as the primary action.

#### Scenario: User edits selected profile

- **WHEN** the user selects a profile in `/model-profile` and presses `Enter`
- **THEN** the system opens the editor for that selected profile without changing the active profile

#### Scenario: User activates selected profile when configuration is valid

- **WHEN** valid profile configuration is available
- **AND** the user selects a profile in `/model-profile` and presses `Space`
- **THEN** the system records that profile as active
- **AND** attempts to activate that profile's low route immediately
- **AND** shows a concise success notification when activation succeeds

#### Scenario: User attempts activation when configuration is not valid

- **WHEN** profile configuration is missing or invalid
- **AND** the user presses `Space` in the profile list
- **THEN** the system does not attempt profile activation
- **AND** shows a concise warning that a valid configuration is required before activation

#### Scenario: Profile list key hints reflect available actions

- **WHEN** valid profile configuration is available
- **THEN** the profile list shows key hints for editing with `Enter`, activating with `Space`, and closing with `Esc`

#### Scenario: Profile list key hints hide unavailable activation

- **WHEN** profile configuration is missing or invalid
- **THEN** the profile list shows key hints for editing with `Enter` and closing with `Esc`
- **AND** does not show `Space` activation as an available action

### Requirement: Profile manager status display

The `/model-profile` interface SHALL present configuration status as a global contextual message in the profile list instead of repeating setup or repair tags on each profile row.

#### Scenario: Valid configuration status is shown

- **WHEN** the user opens `/model-profile` with valid profile configuration
- **THEN** the profile list shows a global ready message that includes the active profile name
- **AND** profile rows do not include repeated setup or repair tags

#### Scenario: Missing configuration status is shown

- **WHEN** the user opens `/model-profile` with missing profile configuration
- **THEN** the profile list shows a global message that no profiles are configured yet and that editing starts setup
- **AND** profile rows do not include repeated setup tags

#### Scenario: Invalid configuration status is shown

- **WHEN** the user opens `/model-profile` with invalid profile configuration
- **THEN** the profile list shows a global message that profile configuration needs repair and that editing can fix it
- **AND** profile rows do not include repeated repair tags

### Requirement: Profile route editor navigation text

The `/model-profile` route editor SHALL keep direct route editing and save-on-escape behavior while making the navigation text explicit.

#### Scenario: User opens selected profile editor

- **WHEN** the user chooses to edit a profile from the profile list
- **THEN** the system opens the route editor for that profile directly
- **AND** does not show a separate read-only detail screen first

#### Scenario: User edits selected route

- **WHEN** the user selects a route in the route editor and presses `Enter`
- **THEN** the system prompts for the route model
- **AND** then prompts for the route thinking level supported by that model
- **AND** returns to the route editor after both selections are complete

#### Scenario: User saves from route editor

- **WHEN** all fixed routes have a selected model and thinking level
- **AND** the user presses `Esc` in the route editor
- **THEN** the system saves the profile configuration and returns to the profile list

#### Scenario: User attempts to save incomplete route editor

- **WHEN** one or more fixed routes have no selected model
- **AND** the user presses `Esc` in the route editor
- **THEN** the system does not save the profile configuration
- **AND** remains in the route editor
- **AND** shows a concise warning listing the routes that must be completed before saving

#### Scenario: Route editor key hints are explicit

- **WHEN** the route editor is shown
- **THEN** the key hints state that `Enter` changes the selected route and `Esc` saves the profile and returns

### Requirement: Model profile footer status

The system SHALL publish the current model-profile state as a footer status, SHALL keep successful saves quiet, and SHALL allow a concise informational notification for explicit successful profile activation.

#### Scenario: Active profile status is shown

- **WHEN** valid profile configuration is loaded and the active profile low route is applied successfully
- **THEN** the system publishes `<name> profile` as the `model-profile` footer status
- **AND** the status uses dim styling

#### Scenario: Setup status is shown

- **WHEN** profile configuration is missing
- **THEN** the system publishes `profile setup` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Invalid status is shown

- **WHEN** profile configuration is invalid
- **THEN** the system publishes `profile invalid` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Failed status is shown

- **WHEN** valid profile configuration is available but the active profile low route cannot be activated
- **THEN** the system publishes `profile failed` as the `model-profile` footer status
- **AND** the status uses warning styling

#### Scenario: Successful profile save is quiet

- **WHEN** a profile is saved successfully
- **THEN** the system updates the footer status when applicable
- **AND** does not show an informational notification for the successful save

#### Scenario: Explicit profile activation shows success feedback

- **WHEN** the user explicitly activates a profile from the profile list
- **AND** activation succeeds
- **THEN** the system updates the footer status
- **AND** shows a concise informational notification for the successful activation
