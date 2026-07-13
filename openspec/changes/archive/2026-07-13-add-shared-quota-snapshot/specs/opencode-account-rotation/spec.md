## MODIFIED Requirements

### Requirement: Balanced account selection on session start

At session start, the system SHALL select an OpenCode Go account from usable observations already present in the aggregated quota snapshot without waiting for network requests. Fresh and degraded observations no more than 30 minutes old SHALL compete equally; an account remains eligible only when its monthly, weekly, and rolling windows all have remaining quota. Among eligible accounts, the system SHALL maximize the minimum remaining percentage, resolving ties by monthly, weekly, then rolling remaining percentage.

#### Scenario: Select the most balanced account

- **WHEN** a refresh resolves observations for two accounts where account "1" has windows `90/5/90` and account "2" has windows `80/80/80` for monthly/weekly/rolling
- **THEN** account "1" has score 5 and account "2" has score 80
- **AND** the system records account "2" as best eligible

#### Scenario: Exhausted monthly window is rejected

- **WHEN** a refresh resolves observations for account "1" with windows `0/88/100` and account "2" with windows `60/70/80`
- **THEN** account "1" is rejected because its monthly window is exhausted
- **AND** the system records account "2" as best eligible

#### Scenario: Missing quota window is rejected

- **WHEN** an account's observation does not include one of the monthly, weekly, or rolling windows
- **THEN** that account is not considered eligible

#### Scenario: No account has all quota windows available

- **WHEN** no configured account has all three quota windows above 0%
- **THEN** no account is recorded as eligible
- **AND** the system retains the current active account or blind fallback

#### Scenario: Recent shared snapshot exists

- **WHEN** session startup finds usable observations for configured OpenCode accounts
- **THEN** account selection completes from the snapshot without fetching quota
- **AND** the selected account is activated via `authStorage.setRuntimeApiKey("opencode-go", apiKey)`

#### Scenario: Degraded observation competes with fresh observation

- **WHEN** account "1" has a degraded 20-minute-old observation with score 80 and account "2" has a fresh observation with score 50
- **THEN** account "1" is selected

#### Scenario: Exhausted or expired account is rejected

- **WHEN** an account has any quota window at 0%, provider-confirmed exhaustion, or an observation older than 30 minutes
- **THEN** that account is not eligible for snapshot-driven selection

#### Scenario: No usable snapshot observation exists

- **WHEN** session startup has no eligible account observation
- **THEN** startup does not wait for the asynchronous centralized refresh
- **AND** the first configured account with a runtime API key is activated as a blind fallback

#### Scenario: First usable snapshot arrives after blind fallback

- **WHEN** a blind fallback is active and the first usable refreshed observations identify another best account
- **THEN** the system schedules reevaluation
- **AND** it changes the runtime account only after Pi is fully settled and idle

## REMOVED Requirements

### Requirement: Automatic rotation on provider error

**Reason**: Rotation is now driven by shared snapshot revisions rather than inline provider-error detection at the end of a message. Provider-confirmed exhaustion is published through the shared snapshot, and preventive reselection triggers when the active account becomes unusable.

**Migration**: See "Preventive reselection uses snapshot revisions" and "Shared observations do not globalize rotation state".

### Requirement: Cooldown state tracking

**Reason**: Cooldown timers were part of the direct-fetch rotation flow. The snapshot-driven approach does not use cooldowns; selection and reselection are based on observation freshness (≤30 min) and quota exhaustion.

### Requirement: Fallback continuation after rotation

**Reason**: The snapshot-driven lifecycle does not perform inline rotation on provider error, so no continuation message is queued during rotation. Reselection happens preventively between runs.

### Requirement: Session-scoped state

**Reason**: Per-session rotation state (cooldowns, attempted accounts, continuation pending) is no longer tracked since rotation is driven by shared snapshot revisions and local runtime state is lightweight.

## ADDED Requirements

### Requirement: Preventive reselection uses snapshot revisions

The system SHALL keep a usable active OpenCode account stable across periodic snapshot revisions and SHALL reselect preventively only when the active account becomes unusable.

#### Scenario: Another account becomes better balanced

- **WHEN** a periodic snapshot reports another account with a higher selection score while the active account remains usable
- **THEN** the active account does not change

#### Scenario: Active account becomes unusable while Pi is idle

- **WHEN** a snapshot revision reports an exhausted, expired, unavailable, or provider-confirmed exhausted active account
- **AND** Pi is fully settled and idle
- **THEN** the system activates the best eligible alternative

#### Scenario: Active account becomes unusable during an agent run

- **WHEN** a snapshot revision makes the active account ineligible while Pi is still processing retries, compaction, or follow-up messages
- **THEN** the system defers preventive reselection until `agent_settled`
- **AND** it does not change runtime credentials during the active run

### Requirement: Shared observations do not globalize rotation state

The system SHALL share source observations and provider-confirmed exhaustion while keeping active accounts, runtime API keys, attempted-account tracking, continuation state, and cooldowns local to each Pi runtime.

#### Scenario: One process rotates after quota error

- **WHEN** Pi process A rotates away from an exhausted account
- **THEN** process B observes the shared exhaustion evidence
- **AND** process B does not inherit process A's active account, cooldown timestamp, attempted-account set, or continuation state
