# pi-codex-usage-footer Specification

## Purpose

TBD - created by archiving change add-codex-compact-footer. Update Purpose after archive.

## Requirements

### Requirement: Pi footer displays compact Codex quota headroom

The Pi footer SHALL display Codex quota headroom in a compact status string that includes remaining five-hour quota, remaining seven-day quota, and remaining credits when those values are available.

#### Scenario: All Codex quota values are available

- **WHEN** the system has current Codex quota data for remaining five-hour quota, remaining seven-day quota, and remaining credits
- **THEN** the footer displays all three values in one compact Codex status string
- **AND** the string labels each quota window with its exact reset time in `(H:mm)` format (12-hour, no AM/PM)
- **AND** when a quota window resets after the current calendar day, the string prepends the English day abbreviation: `(Mon H:mm)`
- **AND** the string labels credits as `cr`

#### Scenario: Credits are unavailable

- **WHEN** the system has current Codex quota data for remaining five-hour quota and remaining seven-day quota but no current remaining credits value
- **THEN** the footer still displays a compact Codex status string
- **AND** the string omits the credits segment rather than displaying a monetary placeholder or invented zero value

#### Scenario: One quota window is unavailable

- **WHEN** the system has current Codex quota data for only one of the quota windows or credits
- **THEN** the footer displays the currently available Codex values in compact form
- **AND** the string omits unavailable segments rather than expanding into verbose error text

### Requirement: Codex quota footer uses remaining values

The Pi footer SHALL represent Codex quota windows as remaining headroom rather than used consumption, and SHALL represent credits as a remaining integer balance.

#### Scenario: Source data is expressed as percent used

- **WHEN** the source quota data for a Codex window is expressed as used percentage rather than remaining percentage
- **THEN** the footer converts that value to remaining headroom before display

#### Scenario: Credits are available as a balance

- **WHEN** the system has a current remaining credits value for Codex
- **THEN** the footer displays that value as a remaining integer balance
- **AND** the footer does not format the value as currency

### Requirement: Codex quota footer remains visible independently of active provider

The Pi footer SHALL continue to display the Codex quota status independently of which model provider is currently active.

#### Scenario: Active model is Codex

- **WHEN** the active model provider is Codex
- **THEN** the footer displays the compact Codex quota status alongside the rest of the footer information

#### Scenario: Active model is not Codex

- **WHEN** the active model provider is not Codex
- **THEN** the footer still displays the compact Codex quota status alongside the rest of the footer information

### Requirement: Codex quota footer uses Pi Codex authentication

The Pi footer SHALL resolve Codex usage authentication from Pi's Codex login credentials rather than from external tool-specific auth files.

#### Scenario: Pi Codex authentication is available

- **WHEN** Pi has usable Codex authentication for the Codex quota footer
- **THEN** the footer uses that authentication to request Codex quota data
- **AND** the footer displays the compact Codex quota status when quota data is returned

#### Scenario: Pi Codex authentication refreshes successfully

- **WHEN** Pi Codex authentication requires refresh before Codex quota data can be requested
- **THEN** the footer uses Pi's authentication mechanism to obtain a usable access token
- **AND** the footer requests Codex quota data with the refreshed authentication

#### Scenario: External tool auth exists but Pi Codex authentication is unavailable

- **WHEN** external tool-specific Codex authentication exists outside Pi
- **AND** Pi Codex authentication is unavailable
- **THEN** the footer does not use the external tool-specific authentication for Codex quota data
- **AND** the footer reports the missing Pi Codex authentication state

### Requirement: Codex quota footer reports missing Pi authentication

The Pi footer SHALL display a compact Codex authentication status when Pi Codex authentication is unavailable.

#### Scenario: Pi Codex authentication is missing

- **WHEN** the Codex quota footer cannot obtain usable Pi Codex authentication
- **THEN** the footer displays `codex auth missing` for the Codex quota status
- **AND** the footer does not invent quota values

### Requirement: Codex quota footer preserves cached data after transient fetch failures

The Pi footer SHALL retry a failed Codex quota fetch once after obtaining usable authentication, and SHALL preserve the last known Codex quota status if the retry also fails.

#### Scenario: Retry succeeds

- **WHEN** the first Codex quota fetch attempt fails after usable authentication is obtained
- **AND** the immediate retry succeeds
- **THEN** the footer displays the quota status from the successful retry

#### Scenario: Retry fails and cached data exists

- **WHEN** the first Codex quota fetch attempt fails after usable authentication is obtained
- **AND** the immediate retry also fails
- **AND** cached Codex quota data exists
- **THEN** the footer keeps displaying the cached Codex quota status

#### Scenario: Retry fails and no cached data exists

- **WHEN** the first Codex quota fetch attempt fails after usable authentication is obtained
- **AND** the immediate retry also fails
- **AND** no cached Codex quota data exists
- **THEN** the footer omits quota values rather than displaying invented data

### Requirement: Pi footer displays OpenCode Go usage quota headroom

The Pi footer SHALL display OpenCode Go quota headroom in the combined quota status when OpenCode Go dashboard usage data is available, and SHALL identify the OpenCode group with the visible prefix `OC`.

#### Scenario: All OpenCode Go usage windows are available

- **WHEN** the system has current OpenCode Go usage data for rolling, weekly, and monthly windows
- **THEN** the footer displays remaining headroom for all three OpenCode Go windows in the combined quota status
- **AND** the OpenCode Go group is visibly identified with the prefix `OC`
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

The Pi footer SHALL combine Codex quota and OpenCode Go quota into one compact quota status while treating each provider as an independently available data source.

#### Scenario: Both providers return current quota data

- **WHEN** current Codex quota data and current OpenCode Go quota data are both available
- **THEN** the footer displays both provider groups in the combined quota status
- **AND** the Codex provider group is visibly identified with the prefix `CODEX`
- **AND** the OpenCode Go provider group is visibly identified with the prefix `OC`

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

### Requirement: Combined quota footer uses a single quota extension status

The Pi footer SHALL render the combined quota status from a single quota extension status entry so that Codex and OpenCode quota data appear once in the footer.

#### Scenario: Quota status is available

- **WHEN** the quota extension publishes a combined quota status
- **THEN** the custom Pi footer displays that status as the quota area of the footer
- **AND** the same quota status is not duplicated in the other extension status area

### Requirement: Combined quota footer remains available after extension directory refactor

The managed Pi quota extension SHALL remain discoverable as a Pi extension after it is represented as a directory-based extension.

#### Scenario: Pi discovers managed extensions

- **WHEN** Pi discovers extensions from the managed agent extensions directory
- **THEN** the combined quota extension is available from the directory-based quota extension entrypoint
- **AND** the old Codex-named entrypoint is not also loaded as a duplicate quota extension

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
