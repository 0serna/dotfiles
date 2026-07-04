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

### Requirement: OpenCode Go quota footer uses dashboard cookie configuration

The Pi footer SHALL request OpenCode Go quota data from the OpenCode dashboard only when both the OpenCode Go workspace ID and dashboard auth cookie are configured.

#### Scenario: OpenCode Go dashboard configuration is complete

- **WHEN** `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE` are both configured
- **THEN** the footer uses the configured workspace ID and auth cookie to request the OpenCode dashboard
- **AND** the footer parses OpenCode Go usage data from the dashboard response when present

#### Scenario: OpenCode Go dashboard configuration is incomplete

- **WHEN** either `OPENCODE_GO_WORKSPACE_ID` or `OPENCODE_GO_AUTH_COOKIE` is not configured
- **THEN** the footer does not attempt an OpenCode Go dashboard request
- **AND** the missing OpenCode Go configuration does not prevent Codex quota data from being displayed

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

### Requirement: Codex quota footer reads reset credit details from dedicated endpoint

The Codex quota footer SHALL read banked reset credit data from the dedicated `GET /backend-api/wham/rate-limit-reset-credits` endpoint and SHALL treat that endpoint as the sole source of truth for the reset credit count and per-credit details.

#### Scenario: Reset credit details fetch succeeds

- **WHEN** the dedicated reset-credits endpoint returns a response with at least one credit whose `status` is `available`
- **THEN** the Codex quota footer populates `bankedResetDetails` with the available credits sorted by `expiresAt` ascending
- **AND** the count used by the compact `R<n>` segment is the length of that array

#### Scenario: Reset credit details fetch fails

- **WHEN** the dedicated reset-credits endpoint request fails or returns a non-2xx response after the single retry
- **THEN** `bankedResetDetails` is `undefined`
- **AND** the Codex quota footer omits the `R` segment from the compact status
- **AND** the Codex quota footer does not read `rate_limit_reset_credits.available_count` from the `/usage` response as a fallback
- **AND** the failure does not affect rate-limit windows or credits display

#### Scenario: Reset credit details endpoint returns no available credits

- **WHEN** the dedicated reset-credits endpoint returns a response with no credits whose `status` is `available`
- **THEN** `bankedResetDetails` is defined as an empty array
- **AND** the count used by the compact `R<n>` segment is `0`
- **AND** the `/quota` detail view shows the `Resets 0` row with no `#n` sub-lines

#### Scenario: Reset credit details endpoint is fetched in parallel with usage

- **WHEN** the Codex quota footer refreshes data
- **THEN** the dedicated reset-credits endpoint is fetched in parallel with the existing `/usage` endpoint
- **AND** a single retry is applied to the reset-credits fetch on failure before reporting `undefined`

### Requirement: Codex quota footer compact status rules for reset credits

The Codex quota footer compact status SHALL display the `R<n>` reset credit segment only when a Codex quota window is exhausted, using the length of `bankedResetDetails` to determine `n` and the array state to determine styling.

#### Scenario: Reset credit count greater than zero

- **WHEN** a Codex quota window remaining quota is exhausted
- **AND** `bankedResetDetails` is defined with length greater than `0`
- **THEN** the footer displays the reset credit segment as `R<n>` with `n` equal to the array length
- **AND** the segment uses positive accent styling
- **AND** the segment appears before the remaining credits segment `C<n>` when both segments are displayed
- **AND** the footer does not merge banked reset credits with remaining credits

#### Scenario: Reset credit count is zero

- **WHEN** a Codex quota window remaining quota is exhausted
- **AND** `bankedResetDetails` is defined as an empty array
- **THEN** the footer displays `R0`
- **AND** the `R0` segment uses dim styling

#### Scenario: Reset credit details are unavailable

- **WHEN** a Codex quota window remaining quota is exhausted
- **AND** `bankedResetDetails` is `undefined`
- **THEN** the footer omits the `R` segment from the compact Codex status
- **AND** the footer does not invent `R0` or another placeholder

#### Scenario: All Codex windows are healthy

- **WHEN** no Codex quota window remaining quota is exhausted
- **THEN** the footer omits the reset credit segment regardless of `bankedResetDetails`
