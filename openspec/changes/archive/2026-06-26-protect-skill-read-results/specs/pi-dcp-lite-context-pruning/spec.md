# pi-dcp-lite-context-pruning Specification Delta

## MODIFIED Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only non-recent `toolResult` messages that match deterministic stale-output rules: duplicate output, resolved error, superseded file operation, or old large textual tool result output over a 1500-token estimate. Explicit `read` results for paths ending in `SKILL.md` SHALL NOT be stubbed by the old-large-output rule, but MAY still be stubbed by duplicate output, resolved error, or superseded file operation rules.

#### Scenario: Duplicate output is stubbed

- **WHEN** a non-recent `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL replace the duplicate result content with an informational stub

#### Scenario: Resolved error is stubbed

- **WHEN** a non-recent error `toolResult` is followed by a later successful result for the same operation
- **THEN** DCP SHALL replace the error result content with an informational stub

#### Scenario: Superseded file result is stubbed

- **WHEN** a non-recent read, write, or edit `toolResult` targets a file that is targeted by a later read, write, or edit operation
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Old large textual tool result is stubbed

- **WHEN** a non-recent textual `toolResult` has an estimated size greater than 1500 tokens and is not an explicit `read` result for a path ending in `SKILL.md`
- **THEN** DCP SHALL replace the result content with an informational stub

#### Scenario: Old large skill read is preserved

- **WHEN** a non-recent `read` `toolResult` targets a path ending in `SKILL.md`
- **AND** the result only qualifies for size-based pruning
- **THEN** DCP SHALL leave the result content unchanged
