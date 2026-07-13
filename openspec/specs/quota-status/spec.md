# quota-status Specification

## Purpose

The compact quota status shows a one-line summary of remaining quota across providers in the Pi footer. It displays the most-constrained window percentage per provider with a window-type suffix (`%r` rolling, `%w` weekly, `%m` monthly), a banked-reset count for Codex, and a degraded marker (`⚠`) when applicable.

## Requirements

### Requirement: Status format

The compact quota status SHALL show one locally active source per provider as a remaining percentage with a window-type suffix, separated by `-`. Codex SHALL also show the banked-reset count.

#### Scenario: Single provider with rolling window

- **WHEN** Codex rolling quota is 80% with two known banked resets
- **THEN** status shows `Codex 80%r R2`

#### Scenario: Both providers healthy

- **WHEN** Codex rolling quota is 80% with two known banked resets and OpenCode has rolling quota 75%
- **THEN** status shows `Codex 80%r R2 - OC 75%r`

#### Scenario: Spendable balances are available

- **WHEN** Codex credits or an OpenCode dollar balance exists
- **THEN** compact status omits those balances
- **AND** `/quota` remains responsible for displaying them

### Requirement: Window selection priority

The compact status SHALL display the most-constrained non-exhausted window for a source, ordered by priority: rolling, weekly, then monthly. Each window SHALL include its type suffix: `%r` (rolling), `%w` (weekly), or `%m` (monthly).

#### Scenario: Monthly exhausted

- **WHEN** a source's monthly window is 0% while weekly and rolling are above 0%
- **THEN** status displays the rolling or weekly percentage with its suffix
- **AND** status does not display 0% for the monthly window

#### Scenario: Weekly exhausted, monthly healthy

- **WHEN** a source's weekly window is 0% while monthly and rolling are above 0%
- **THEN** status displays `0%` (any exhausted window triggers exhaustion display)

#### Scenario: All windows healthy

- **WHEN** rolling, weekly, and monthly windows are all above 0%
- **THEN** status displays the rolling remaining percentage with `%r` suffix

#### Scenario: Rolling missing, fallback

- **WHEN** no rolling percentage exists but another window has a remaining percentage and none is exhausted
- **THEN** the adapter-provided fallback percentage is displayed with the appropriate suffix
- **AND** status does not invent a rolling value

### Requirement: Color intents

Each provider segment SHALL use color intents to convey state: `dim` for healthy data, `warning` for percentages below 10%, degraded markers, and error states. The separator between providers SHALL also use `dim`.

#### Scenario: Healthy window, dim styling

- **WHEN** a source has no exhausted windows and its lowest window is above 10%
- **THEN** its entire segment is displayed with `dim` intent

#### Scenario: Low percentage below 10%

- **WHEN** a source has any window at or below 10% remaining (but not exhausted)
- **THEN** its percentage is displayed with `warning` intent
- **AND** the banked-reset label and provider prefix remain `dim`

#### Scenario: Exhausted window

- **WHEN** a source has any exhausted (0%) window
- **THEN** status displays `0%` with the appropriate suffix
- **AND** the percentage is displayed with `warning` intent

### Requirement: Exhausted state rendering

An active source with any exhausted quota window or provider-confirmed exhaustion SHALL display `0%` with the window suffix. It SHALL NOT add reset times, credits, or dollar balances.

#### Scenario: Codex exhausted with credits

- **WHEN** Codex has an exhausted window with two known banked resets and 100 remaining credits
- **THEN** status shows `Codex 0%r R2` (or appropriate window suffix)
- **AND** credits are not displayed in compact status

#### Scenario: Codex exhausted, no resets

- **WHEN** Codex has an exhausted window with zero banked resets
- **THEN** status shows `Codex 0%r R0`

#### Scenario: OpenCode exhausted with balance

- **WHEN** an OpenCode source has an exhausted window and a dollar balance
- **THEN** status shows `OC 0%r` (or appropriate window suffix)
- **AND** the balance is not displayed in compact status

### Requirement: Resets visibility in compact

Compact Codex status SHALL always display banked-reset state as `R<n>` when known and `R?` when unavailable.

#### Scenario: Exhausted window with resets

- **WHEN** Codex has any exhausted window and three available banked resets
- **THEN** status includes `R3`

#### Scenario: Healthy window with resets available

- **WHEN** Codex has no exhausted window and three available banked resets
- **THEN** status includes `R3`
- **AND** the R segment is not hidden when resets are available

#### Scenario: Exhausted window with zero resets

- **WHEN** Codex has an exhausted window and banked-reset data reports zero available credits
- **THEN** status includes `R0`

#### Scenario: Reset data is unavailable

- **WHEN** Codex usage is available but banked-reset data is unavailable
- **THEN** status includes `R?`
- **AND** it does not append the degraded marker solely for that partial failure

### Requirement: Status reflects source lifecycle state

Compact status SHALL distinguish initial loading, retained degraded data, and unusable source data while keeping detailed failure reasons in `/quota` and logs.

#### Scenario: No usable observations exist during initial refresh

- **WHEN** the runtime starts with a missing or fully expired snapshot and refresh is in progress
- **THEN** status shows `Quota …`

#### Scenario: One provider is still loading

- **WHEN** one provider has resolved and another provider has no prior observation and is still refreshing
- **THEN** the resolved provider displays its value
- **AND** the unresolved provider displays its compact prefix followed by `…` (e.g. `Codex …` or `OC …`)

#### Scenario: Retained source is degraded

- **WHEN** a displayed source uses an observation retained after a failed refresh and the observation is no more than 30 minutes old
- **THEN** its value remains visible
- **AND** status prefixes the segment with `⚠ ` using warning intent

#### Scenario: Source has no usable data

- **WHEN** a displayed source is unavailable, expired, or failed without a retained observation
- **THEN** status shows the compact prefix followed by `error` (e.g. `Codex error`)
- **AND** it does not expose the detailed cause

### Requirement: Combined status uses the quota extension key

The quota extension SHALL publish the complete combined compact value through the single `quota` status key so the custom footer displays it once in its reserved quota area.

#### Scenario: Snapshot projection changes

- **WHEN** a local snapshot revision, active source, or lifecycle state changes
- **THEN** the extension updates `ctx.ui.setStatus("quota", value)` best-effort
- **AND** no separate provider status key duplicates the value

### Requirement: Periodic failures do not notify

Failed background quota refreshes SHALL be communicated through compact status, `/quota`, and structured logs without producing periodic UI notifications.

#### Scenario: Periodic source refresh fails

- **WHEN** a source exhausts its two attempts during a scheduled refresh
- **THEN** no `ctx.ui.notify` call is emitted for that failure
- **AND** the source lifecycle state is reflected in status and quota detail
