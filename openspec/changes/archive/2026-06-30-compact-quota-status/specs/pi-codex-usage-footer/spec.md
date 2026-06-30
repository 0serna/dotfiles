## MODIFIED Requirements

### Requirement: Pi footer displays compact Codex quota headroom

The Pi footer SHALL display Codex quota headroom in a compact status string that prioritizes actionable quota state while preserving available Codex quota data when it is the only usable window data.

#### Scenario: Codex short window is available and long window is healthy

- **WHEN** the system has current Codex quota data for the short window and seven-day window
- **AND** the seven-day window remaining quota is not below the low-quota threshold
- **THEN** the footer displays the Codex short window as `R(<remaining>% <reset>)`
- **AND** the footer omits the healthy seven-day window from the compact Codex status

#### Scenario: Codex seven-day window is below threshold

- **WHEN** the system has current Codex quota data for the short window and seven-day window
- **AND** the seven-day window remaining quota is below the low-quota threshold
- **THEN** the footer displays the Codex short window as `R(<remaining>% <reset>)`
- **AND** the footer displays the seven-day window as `W(<remaining>% <reset>)`

#### Scenario: Codex short window is unavailable

- **WHEN** the system has current Codex quota data for the seven-day window but not the short window
- **THEN** the footer displays the seven-day window as `W(<remaining>% <reset>)`
- **AND** the footer omits unavailable segments rather than expanding into verbose error text

### Requirement: Codex quota footer uses remaining values

The Pi footer SHALL represent Codex quota windows as remaining headroom rather than used consumption, and SHALL represent credits as a remaining integer balance when credits are displayed.

#### Scenario: Source data is expressed as percent used

- **WHEN** the source quota data for a Codex window is expressed as used percentage rather than remaining percentage
- **THEN** the footer converts that value to remaining headroom before display

#### Scenario: Credits are available as a balance and not being consumed

- **WHEN** the system has a current remaining credits value for Codex
- **AND** no Codex quota window is exhausted
- **THEN** the footer omits the credits segment from the compact Codex status
- **AND** the footer does not format the value as currency

#### Scenario: Credits are being consumed

- **WHEN** the system has a current remaining credits value for Codex
- **AND** any Codex quota window is exhausted
- **THEN** the footer displays the credits segment as `C<n>`
- **AND** the footer does not format the value as currency

### Requirement: Pi footer displays OpenCode Go usage quota headroom

The Pi footer SHALL display OpenCode Go quota headroom in the combined quota status when OpenCode Go dashboard usage data is available, and SHALL identify the OpenCode group with the visible prefix `OpenCode`.

#### Scenario: OpenCode rolling window is available and longer windows are healthy

- **WHEN** the system has current OpenCode Go usage data for rolling, weekly, and monthly windows
- **AND** the weekly and monthly windows remaining quota are not below the low-quota threshold
- **THEN** the footer displays the rolling window as `R(<remaining>% <reset>)`
- **AND** the OpenCode Go group is visibly identified with the prefix `OpenCode`
- **AND** the footer omits the healthy weekly and monthly windows from the compact OpenCode status

#### Scenario: OpenCode longer windows are below threshold

- **WHEN** the system has current OpenCode Go usage data for rolling, weekly, and monthly windows
- **AND** the weekly or monthly window remaining quota is below the low-quota threshold
- **THEN** the footer displays the rolling window as `R(<remaining>% <reset>)`
- **AND** the footer displays each below-threshold weekly window as `W(<remaining>% <reset>)`
- **AND** the footer displays each below-threshold monthly window as `M(<remaining>% <reset>)`

#### Scenario: OpenCode rolling window is unavailable

- **WHEN** the system has current OpenCode Go usage data for only some OpenCode Go windows
- **AND** the rolling window is unavailable
- **THEN** the footer displays the first available OpenCode Go window using its normalized window label
- **AND** the footer omits unavailable OpenCode Go windows rather than inventing placeholder values

### Requirement: Pi footer displays OpenCode Go dollar balance

The Pi footer SHALL display the OpenCode Go dashboard balance as a remaining dollar amount only when the balance is available and an OpenCode Go quota window is exhausted.

#### Scenario: OpenCode Go balance is available and no window is exhausted

- **WHEN** the system has current OpenCode Go billing data with a dashboard balance value
- **AND** no OpenCode Go usage window is exhausted
- **THEN** the footer omits the OpenCode Go balance segment from the compact OpenCode status

#### Scenario: OpenCode Go balance is available and a window is exhausted

- **WHEN** the system has current OpenCode Go billing data with a dashboard balance value
- **AND** an OpenCode Go usage window is exhausted
- **THEN** the footer displays the OpenCode Go balance as currency
- **AND** the footer does not label the OpenCode Go balance as Codex credits

#### Scenario: OpenCode Go balance is unavailable

- **WHEN** OpenCode Go usage window data is available but OpenCode Go billing balance data is unavailable
- **THEN** the footer displays the available OpenCode Go usage windows according to the compact window visibility rules
- **AND** the footer omits the OpenCode Go balance segment rather than displaying an invented zero value

### Requirement: Combined usage quota footer preserves provider isolation

The Pi footer SHALL combine Codex quota and OpenCode Go quota into one compact quota status while treating each provider as an independently available data source.

#### Scenario: Both providers return current quota data

- **WHEN** current Codex quota data and current OpenCode Go quota data are both available
- **THEN** the footer displays the Codex provider group before the OpenCode provider group
- **AND** the Codex provider group is visibly identified with the prefix `Codex`
- **AND** the OpenCode Go provider group is visibly identified with the prefix `OpenCode`

#### Scenario: Codex succeeds and OpenCode Go fails

- **WHEN** current Codex quota data is available
- **AND** OpenCode Go quota data cannot be fetched or parsed
- **THEN** the footer displays the Codex quota group
- **AND** the footer includes `OpenCode error` rather than hiding the Codex quota group

#### Scenario: OpenCode Go succeeds and Codex fails

- **WHEN** current OpenCode Go quota data is available
- **AND** Codex quota data cannot be fetched or parsed
- **THEN** the footer displays the OpenCode Go quota group
- **AND** the footer includes `Codex error` rather than hiding the OpenCode Go quota group

#### Scenario: Neither provider has current or cached data

- **WHEN** neither Codex quota data nor OpenCode Go quota data is available
- **THEN** the footer does not invent quota values

### Requirement: Codex quota footer displays banked reset credits

The Pi footer SHALL display the number of Codex banked rate-limit reset credits when the Codex usage response explicitly provides that count and any Codex quota window is below the low-quota threshold.

#### Scenario: Banked reset credits are available and Codex quota is below threshold

- **WHEN** the Codex usage response includes `rate_limit_reset_credits.available_count` with a positive numeric value
- **AND** any Codex quota window remaining quota is below the low-quota threshold
- **THEN** the Codex quota footer displays the banked reset count as `R<n>`
- **AND** the `R<n>` segment uses positive accent styling
- **AND** the `R<n>` segment appears before the remaining credits segment `C<n>` when both segments are displayed
- **AND** the footer does not merge banked reset credits with remaining credits

#### Scenario: Zero banked reset credits are explicitly reported and Codex quota is below threshold

- **WHEN** the Codex usage response includes `rate_limit_reset_credits.available_count` with value `0`
- **AND** any Codex quota window remaining quota is below the low-quota threshold
- **THEN** the Codex quota footer displays `R0`
- **AND** the `R0` segment uses dim styling

#### Scenario: Banked reset credits are available and Codex quota is healthy

- **WHEN** the Codex usage response includes `rate_limit_reset_credits.available_count`
- **AND** no Codex quota window remaining quota is below the low-quota threshold
- **THEN** the Codex quota footer omits the banked reset segment

#### Scenario: Banked reset credit data is unavailable

- **WHEN** the Codex usage response omits `rate_limit_reset_credits` or reports it as `null`
- **THEN** the Codex quota footer omits the banked reset segment
- **AND** the footer does not invent `R0` or another placeholder

#### Scenario: Reset expiration and history are unavailable

- **WHEN** the Codex usage response provides a banked reset count without reset expiration or history details
- **AND** any Codex quota window remaining quota is below the low-quota threshold
- **THEN** the Codex quota footer displays only the count segment `R<n>`
- **AND** the footer does not infer or display expiration, eligibility, or reset history
