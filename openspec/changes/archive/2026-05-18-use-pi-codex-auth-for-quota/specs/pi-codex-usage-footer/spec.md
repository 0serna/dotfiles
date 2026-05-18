## ADDED Requirements

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
