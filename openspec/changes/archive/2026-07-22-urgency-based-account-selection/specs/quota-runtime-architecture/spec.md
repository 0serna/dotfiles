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
