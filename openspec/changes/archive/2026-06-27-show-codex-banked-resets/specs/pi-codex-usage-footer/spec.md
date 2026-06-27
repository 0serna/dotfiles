## ADDED Requirements

### Requirement: Codex quota footer displays banked reset credits

The Pi footer SHALL display the number of Codex banked rate-limit reset credits when the Codex usage response explicitly provides that count.

#### Scenario: Banked reset credits are available

- **WHEN** the Codex usage response includes `rate_limit_reset_credits.available_count` with a positive numeric value
- **THEN** the Codex quota footer displays the banked reset count as `R<n>`
- **AND** the `R<n>` segment uses positive accent styling
- **AND** the `R<n>` segment appears before the existing remaining credits segment `C<n>` when both segments are displayed
- **AND** the footer does not merge banked reset credits with remaining credits

#### Scenario: Zero banked reset credits are explicitly reported

- **WHEN** the Codex usage response includes `rate_limit_reset_credits.available_count` with value `0`
- **THEN** the Codex quota footer displays `R0`
- **AND** the `R0` segment uses dim styling

#### Scenario: Banked reset credit data is unavailable

- **WHEN** the Codex usage response omits `rate_limit_reset_credits` or reports it as `null`
- **THEN** the Codex quota footer omits the banked reset segment
- **AND** the footer does not invent `R0` or another placeholder

#### Scenario: Reset expiration and history are unavailable

- **WHEN** the Codex usage response provides a banked reset count without reset expiration or history details
- **THEN** the Codex quota footer displays only the count segment `R<n>`
- **AND** the footer does not infer or display expiration, eligibility, or reset history
