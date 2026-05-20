## ADDED Requirements

### Requirement: Pi footer displays OpenCode Go usage quota headroom

The Pi footer SHALL display OpenCode Go quota headroom in the combined usage quota status when OpenCode Go dashboard usage data is available.

#### Scenario: All OpenCode Go usage windows are available

- **WHEN** the system has current OpenCode Go usage data for rolling, weekly, and monthly windows
- **THEN** the footer displays remaining headroom for all three OpenCode Go windows in the combined usage quota status
- **AND** the OpenCode Go group is visibly identified as OpenCode Go rather than Codex
- **AND** each OpenCode Go window is represented as remaining percentage rather than used percentage
- **AND** each OpenCode Go window includes a compact reset label derived from the dashboard reset duration

#### Scenario: One OpenCode Go usage window is unavailable

- **WHEN** the system has current OpenCode Go usage data for only some OpenCode Go windows
- **THEN** the footer displays the available OpenCode Go windows
- **AND** the footer omits unavailable OpenCode Go windows rather than inventing placeholder values

### Requirement: Pi footer displays OpenCode Go dollar balance

The Pi footer SHALL display the OpenCode Go dashboard balance as a remaining dollar amount when the balance is available.

#### Scenario: OpenCode Go balance is available

- **WHEN** the system has current OpenCode Go billing data with a dashboard balance value
- **THEN** the footer displays the OpenCode Go balance as currency
- **AND** the footer does not label the OpenCode Go balance as Codex credits

#### Scenario: OpenCode Go balance is unavailable

- **WHEN** OpenCode Go usage window data is available but OpenCode Go billing balance data is unavailable
- **THEN** the footer displays the available OpenCode Go usage windows
- **AND** the footer omits the OpenCode Go balance segment rather than displaying an invented zero value

### Requirement: OpenCode Go quota footer uses dashboard cookie configuration

The Pi footer SHALL request OpenCode Go quota data from the OpenCode dashboard only when both the OpenCode Go workspace ID and dashboard auth cookie are configured.

#### Scenario: OpenCode Go dashboard configuration is complete

- **WHEN** `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE` are both configured
- **THEN** the footer uses the configured workspace ID and auth cookie to request the OpenCode Go dashboard
- **AND** the footer parses OpenCode Go usage data from the dashboard response when present

#### Scenario: OpenCode Go dashboard configuration is incomplete

- **WHEN** either `OPENCODE_GO_WORKSPACE_ID` or `OPENCODE_GO_AUTH_COOKIE` is not configured
- **THEN** the footer does not attempt an OpenCode Go dashboard request
- **AND** the missing OpenCode Go configuration does not prevent Codex quota data from being displayed

### Requirement: Combined usage quota footer preserves provider isolation

The Pi footer SHALL combine Codex quota and OpenCode Go quota into one compact usage quota status while treating each provider as an independently available data source.

#### Scenario: Both providers return current quota data

- **WHEN** current Codex quota data and current OpenCode Go quota data are both available
- **THEN** the footer displays both provider groups in the combined usage quota status
- **AND** each provider group is visibly identified so overlapping quota windows are not confused

#### Scenario: Codex succeeds and OpenCode Go fails

- **WHEN** current Codex quota data is available
- **AND** OpenCode Go quota data cannot be fetched or parsed
- **THEN** the footer displays the Codex quota group
- **AND** the footer includes a compact OpenCode Go error indicator rather than hiding the Codex quota group

#### Scenario: OpenCode Go succeeds and Codex fails

- **WHEN** current OpenCode Go quota data is available
- **AND** Codex quota data cannot be fetched or parsed
- **THEN** the footer displays the OpenCode Go quota group
- **AND** the footer includes a compact Codex error indicator rather than hiding the OpenCode Go quota group

#### Scenario: Neither provider has current or cached data

- **WHEN** neither Codex quota data nor OpenCode Go quota data is available
- **THEN** the footer does not invent quota values

### Requirement: Combined usage quota footer fetches providers independently

The Pi footer SHALL refresh Codex quota data and OpenCode Go quota data independently so that latency or failure in one source does not block the other source.

#### Scenario: Provider refreshes run during a quota update

- **WHEN** the quota footer refreshes usage data
- **THEN** Codex quota fetching and OpenCode Go quota fetching are initiated as independent operations
- **AND** each provider result is resolved into the combined usage quota status according to its own success or failure state
