# Spec Delta

## MODIFIED Requirements

### Requirement: Global command copies the latest final assistant response

The system SHALL expose `/last` in the OpenCode CLI TUI for globally configured users. Invoking the command SHALL copy the latest completed, user-visible assistant response from the active session without submitting a prompt to the model.

#### Scenario: Copy the latest answer in the active session

- **WHEN** the user invokes `/last` in an OpenCode session that contains a completed assistant response
- **THEN** the latest final user-visible assistant response from that session is sent to the terminal clipboard

#### Scenario: Command runs outside an active session

- **WHEN** the user invokes `/last` while the TUI is not showing a session
- **THEN** the system leaves the clipboard unchanged and reports that there is no active session
