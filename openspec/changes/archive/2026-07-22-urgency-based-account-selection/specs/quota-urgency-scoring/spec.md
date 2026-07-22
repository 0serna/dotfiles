## ADDED Requirements

### Requirement: Account selection ranks by quota urgency

The account-selection module SHALL rank eligible OpenCode Go accounts by urgency rate, defined as the largest available window's `remainingPercent` divided by its days until reset (`daysUntilReset`). The account with the highest urgency rate SHALL be selected.

#### Scenario: Expiring account outranks higher-percentage peer

- **WHEN** Account A has 20% monthly remaining and resets in 2 days
- **AND** Account B has 60% monthly remaining and resets in 15 days
- **AND** both accounts have all three windows present and above zero
- **THEN** Account A is selected because its urgency rate (10%/day) exceeds Account B's (4%/day)

#### Scenario: Same urgency selects by percentage tiebreaker is unnecessary

- **WHEN** two eligible accounts have different urgency rates
- **THEN** the account with the higher rate wins regardless of the percentage difference

### Requirement: Urgency uses the largest available window

The urgency rate SHALL be computed from the largest available quota window in fallback order: monthly, then weekly, then rolling.

#### Scenario: Monthly window available

- **WHEN** an account has monthly, weekly, and rolling windows all above zero
- **THEN** the urgency rate is computed from the monthly window's `remainingPercent` and `resetAt`

> **Note:** The eligibility guard (all three windows must be present and above zero) means only the monthly window is used in practice for OpenCode Go accounts. The fallback chain exists as future-proofing for providers that may expose a different window set.

### Requirement: Imminent resets receive maximum urgency sentinel

When the largest available window's `daysUntilReset` is less than one hour (1/24 day), the account SHALL receive a maximum-urgency sentinel value. Among accounts with sentinel urgency, the one with the smaller actual `daysUntilReset` SHALL be selected.

#### Scenario: Account resets in 30 minutes

- **WHEN** Account A's largest window has 15% remaining and resets in 30 minutes
- **AND** Account B's largest window has 80% remaining and resets in 3 days
- **THEN** Account A receives sentinel urgency and is selected over Account B

#### Scenario: Two accounts both reset within one hour

- **WHEN** Account A's largest window resets in 10 minutes
- **AND** Account B's largest window resets in 45 minutes
- **THEN** both receive sentinel urgency but Account A is selected because its actual `daysUntilReset` is smaller

### Requirement: Eligibility guards are applied before urgency ranking

Accounts with any quota window at 0% remaining SHALL be ineligible for selection regardless of their urgency rate. Accounts missing any of the three expected windows SHALL also be ineligible.

#### Scenario: Urgent account with exhausted window is skipped

- **WHEN** Account A has 30% monthly resetting in 1 day and a rolling window at 0%
- **AND** Account B has 10% monthly resetting in 7 days with all windows above zero
- **THEN** Account A is ineligible and Account B is selected

## MODIFIED Requirements

### Requirement: Account selection has one runtime-local owner

The quota extension SHALL place OpenCode account activation state, cooldowns, blind fallback, processing-cycle attempts, continuation gating, reactive rotation, and preventive reselection behind one account-selection module interface. Shared quota observations SHALL remain inputs to this module and SHALL NOT make its runtime-local state global. The selection algorithm SHALL rank eligible accounts by quota urgency rate as defined in the quota-urgency-scoring specification.

#### Scenario: Snapshot revision changes account eligibility

- **WHEN** the account-selection module receives a snapshot revision that changes the active account's eligibility
- **THEN** the module determines whether reselection is required using its owned runtime-local state
- **AND** the caller does not coordinate ranking, blind fallback, or pending reselection separately

#### Scenario: Processing cycle exhausts configured accounts

- **WHEN** provider-confirmed quota errors attempt every configured account during one processing cycle
- **THEN** the account-selection module records the attempted accounts and produces the stop outcome
- **AND** a later settled processing cycle clears that runtime-local attempt state
