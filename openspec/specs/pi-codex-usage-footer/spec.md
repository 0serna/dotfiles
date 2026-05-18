# pi-codex-usage-footer Specification

## Purpose

TBD - created by archiving change add-codex-compact-footer. Update Purpose after archive.

## Requirements

### Requirement: Pi footer displays compact Codex quota headroom

The Pi footer SHALL display Codex quota headroom in a compact status string that includes remaining five-hour quota, remaining seven-day quota, and remaining credits when those values are available.

#### Scenario: All Codex quota values are available

- **WHEN** the system has current Codex quota data for remaining five-hour quota, remaining seven-day quota, and remaining credits
- **THEN** the footer displays all three values in one compact Codex status string
- **AND** the string labels the quota windows as `5h` and `7d`
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
