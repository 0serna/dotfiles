## ADDED Requirements

### Requirement: Footer context usage represents current context-window occupancy

The Pi footer SHALL display context usage as the current context-window estimate for the active session state, not as cumulative token totals from the full session history.

#### Scenario: Display current context usage

- **WHEN** the active session state has a current context-window estimate available
- **THEN** the footer displays that current context usage against the active model's context window
- **AND** the displayed value does not substitute cumulative session token totals for current context usage

#### Scenario: Context usage unknown after compaction boundary

- **WHEN** the active session has crossed a compaction boundary and no later assistant response provides trustworthy usage data yet
- **THEN** the footer indicates that current context usage is unknown
- **AND** the footer continues to display the active model's context window when available

### Requirement: Footer cache percentage represents prompt-side cache reuse

The Pi footer SHALL display cache percentage as cumulative prompt-side cache reuse for the active session state, using assistant usage records only.

#### Scenario: Display cache-hit percentage from assistant usage

- **WHEN** assistant usage records include both fresh prompt input and cache-read prompt input
- **THEN** the footer displays cache percentage as cache-read tokens divided by total prompt-side input tokens
- **AND** output tokens and cache-write tokens are excluded from that percentage

#### Scenario: Cache percentage unknown without prompt-side input

- **WHEN** the active session state has no prompt-side input tokens recorded in assistant usage
- **THEN** the footer indicates that cache percentage is unknown
