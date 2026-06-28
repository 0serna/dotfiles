## REMOVED Requirements

### Requirement: Recent message protection

**Reason**: DCP no longer uses a global recent-message protection window; semantic pruning rules can apply immediately, and size-based pruning has its own dedicated age gate.
**Migration**: Use the dedicated stale_large age gate for size-only pruning protection.

## MODIFIED Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only eligible `toolResult` messages that match deterministic stale-output rules: duplicate output, resolved error, superseded file operation, or `stale_large` textual tool result output. Ignored tools SHALL be excluded from pruning, pruning metrics, and DCP age calculations. Explicit `read` results for paths ending in `SKILL.md` SHALL NOT be stubbed by the stale_large rule, but MAY still be stubbed by duplicate output, resolved error, or superseded file operation rules.

#### Scenario: Ignored tool is excluded from DCP

- **WHEN** DCP evaluates a `toolResult` for an ignored tool such as `question`
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Duplicate output is stubbed immediately

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL replace the duplicate result content with an informational stub

#### Scenario: Resolved error is stubbed immediately

- **WHEN** an error `toolResult` is followed by a later successful result for the same operation
- **THEN** DCP SHALL replace the error result content with an informational stub

#### Scenario: Same-tool superseded file result is stubbed immediately

- **WHEN** a read, write, or edit `toolResult` targets a file that is targeted by a later operation with the same normalized tool and same normalized target
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Different-tool file operation is not superseded

- **WHEN** a file `toolResult` targets a file that is targeted by a later file operation with a different normalized tool
- **THEN** DCP SHALL NOT replace the older result content for the superseded reason

#### Scenario: Stale large textual tool result is stubbed after age gate

- **WHEN** a textual `toolResult` is older than 20 DCP-ageable tool results, has an estimated size greater than 2500 tokens, and is not an explicit `read` result for a path ending in `SKILL.md`
- **THEN** DCP SHALL replace the result content with an informational stub

#### Scenario: Large textual tool result inside age gate is preserved from size-only pruning

- **WHEN** a textual `toolResult` is not older than 20 DCP-ageable tool results and only qualifies for stale_large pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Stale large skill read is preserved

- **WHEN** a `read` `toolResult` targets a path ending in `SKILL.md`
- **AND** the result only qualifies for size-based pruning
- **THEN** DCP SHALL leave the result content unchanged

## ADDED Requirements

### Requirement: Stale-large age metrics

DCP SHALL report size-gate protection metrics separately from pruning metrics and SHALL NOT report a global recent-protection count.

#### Scenario: Size-gate protection is counted

- **WHEN** a DCP-ageable `toolResult` exceeds the stale_large token threshold but is not older than 20 DCP-ageable tool results
- **THEN** DCP SHALL count the result as protected by the stale_large age gate
