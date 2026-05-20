## MODIFIED Requirements

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

## ADDED Requirements

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
