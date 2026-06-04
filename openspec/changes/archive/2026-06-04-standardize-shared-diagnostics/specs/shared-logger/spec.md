## ADDED Requirements

### Requirement: Diagnostics Separation

The shared logger SHALL remain responsible for log transport and context injection, while structured error and HTTP response diagnostics SHALL be provided by a separate shared diagnostics module.

#### Scenario: Logger remains transport focused

- **WHEN** an extension writes an event through the shared logger
- **THEN** the logger SHALL write the event using the existing JSONL transport behavior
- **AND** the logger SHALL NOT require the event to be an error or HTTP failure

#### Scenario: Logger does not own failure payload construction

- **WHEN** an extension needs structured failure details
- **THEN** the extension SHALL use shared diagnostics helpers to construct the failure payload
- **AND** the logger SHALL only write the resulting payload as event data
