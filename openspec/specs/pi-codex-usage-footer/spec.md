# pi-codex-usage-footer Specification

## Purpose

TBD - created by archiving change add-codex-compact-footer. Update Purpose after archive.

## Requirements

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
