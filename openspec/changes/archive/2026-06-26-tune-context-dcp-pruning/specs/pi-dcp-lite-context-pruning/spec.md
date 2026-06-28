## MODIFIED Requirements

### Requirement: Recent message protection

DCP SHALL preserve the last 15 messages in the context without stubbing them.

#### Scenario: Recent stale output is protected

- **WHEN** an otherwise eligible `toolResult` is within the last 15 messages
- **THEN** DCP SHALL leave that message unchanged

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only non-recent `toolResult` messages that match deterministic stale-output rules: duplicate output, resolved error, superseded file operation, or `stale_large` textual tool result output over a 1500-token estimate.

#### Scenario: Duplicate output is stubbed

- **WHEN** a non-recent `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL replace the duplicate result content with an informational stub

#### Scenario: Resolved error is stubbed

- **WHEN** a non-recent error `toolResult` is followed by a later successful result for the same operation
- **THEN** DCP SHALL replace the error result content with an informational stub

#### Scenario: Superseded file result is stubbed

- **WHEN** a non-recent read, write, or edit `toolResult` targets a file that is targeted by a later read, write, or edit operation
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Stale large textual tool result is stubbed

- **WHEN** a non-recent textual `toolResult` has an estimated size greater than 1500 tokens
- **THEN** DCP SHALL replace the result content with an informational stub
