# pi-dcp-lite-context-pruning Specification

## Purpose

Automatically reduce stale tool result content in transient context to improve cache stability and reduce token consumption in long tool-heavy sessions, using an explicit tool/mechanism pruning policy allowlist.

## Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only eligible `toolResult` messages that match explicit tool/mechanism pruning policy entries. The allowed pruning mechanisms are `duplicate`, `resolved`, `superseded`, and `stale_large`. Tools without an explicit pruning policy entry SHALL be excluded from pruning, pruning metrics, and DCP age calculations. Explicit `read` results SHALL NOT be stubbed by the `stale_large` rule, but MAY still be stubbed by `resolved` or `superseded` rules. File operation tools SHALL NOT be stubbed by the `duplicate` rule. DCP SHALL use non-truncated semantic operation identities for `resolved` and `superseded` decisions, while display targets MAY be truncated for logs and stubs. DCP SHALL treat `duplicate` as a global normalized-text mechanism independent of operation identity for non-file tools that allow it.

#### Scenario: Tool without pruning policy is excluded from DCP

- **WHEN** DCP evaluates a textual `toolResult` for a tool with no explicit pruning policy entry
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Ignored tool is excluded from DCP

- **WHEN** DCP evaluates a `toolResult` for an ignored tool such as `question` or `multi_tool_use.parallel`
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Duplicate output is stubbed for allowlisted tool

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **AND** the tool policy allows `duplicate`
- **THEN** DCP SHALL replace the duplicate result content with an informational stub

#### Scenario: Duplicate output is preserved without policy

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **AND** the tool policy does not allow `duplicate`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Duplicate file tool output is preserved

- **WHEN** a `read`, `edit`, or `write` `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL leave the result content unchanged for the `duplicate` reason

#### Scenario: Resolved error is stubbed for allowlisted tool

- **WHEN** an error `toolResult` is followed by a later successful result for the same semantic operation identity
- **AND** the tool policy allows `resolved`
- **THEN** DCP SHALL replace the error result content with an informational stub

#### Scenario: Resolved error is preserved without policy

- **WHEN** an error `toolResult` is followed by a later successful result for the same semantic operation identity
- **AND** the tool policy does not allow `resolved`
- **THEN** DCP SHALL leave the error result content unchanged

#### Scenario: Read results with different ranges are not the same resolved operation

- **WHEN** an error `read` result for a file path and one `offset` or `limit` value is followed by a successful `read` result for the same file path with a different `offset` or `limit` value
- **THEN** DCP SHALL NOT replace the error result content for the `resolved` reason

#### Scenario: Same-tool superseded write result is stubbed for allowlisted tool

- **WHEN** a `write` `toolResult` targets a path that is targeted by a later `write` operation with the same normalized path
- **AND** the tool policy allows `superseded`
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Read result with same range is superseded

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit` that are targeted by a later `read` operation with the same normalized path, `offset`, and `limit`
- **AND** the tool policy allows `superseded`
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Read result with different range is preserved from superseded pruning

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit`
- **AND** a later `read` operation targets the same normalized path with a different `offset` or `limit`
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Edit result is preserved from superseded pruning

- **WHEN** an `edit` `toolResult` targets a path that is targeted by a later `edit` operation
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Superseded file result is preserved without policy

- **WHEN** a file `toolResult` targets a semantic operation identity that is targeted by a later operation with the same normalized tool and same semantic operation identity
- **AND** the tool policy does not allow `superseded`
- **THEN** DCP SHALL leave the older result content unchanged

#### Scenario: Different-tool file operation is not superseded

- **WHEN** a file `toolResult` targets a path that is targeted by a later file operation with a different normalized tool
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Stale large textual tool result is stubbed for allowlisted tool after age gate

- **WHEN** a textual `toolResult` is older than 15 DCP-ageable tool results and has an estimated size greater than 2500 tokens
- **AND** the tool policy allows `stale_large`
- **THEN** DCP SHALL replace the result content with an informational stub

#### Scenario: Stale large textual tool result is preserved without policy

- **WHEN** a textual `toolResult` is older than 15 DCP-ageable tool results and has an estimated size greater than 2500 tokens
- **AND** the tool policy does not allow `stale_large`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Large textual tool result inside age gate is preserved from size-only pruning

- **WHEN** a textual `toolResult` is not older than 15 DCP-ageable tool results and only qualifies for `stale_large` pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Stale large read is preserved

- **WHEN** a `read` `toolResult` only qualifies for size-based pruning
- **THEN** DCP SHALL leave the result content unchanged

### Requirement: Stale-large age metrics

DCP SHALL report size-gate protection metrics separately from pruning metrics and SHALL NOT report a global recent-protection count. DCP SHALL only count size-gate protection for tools whose pruning policy allows `stale_large`.

#### Scenario: Size-gate protection is counted for allowlisted tool

- **WHEN** a DCP-ageable `toolResult` exceeds the `stale_large` token threshold but is not older than 15 DCP-ageable tool results
- **AND** the tool policy allows `stale_large`
- **THEN** DCP SHALL count the result as protected by the `stale_large` age gate

#### Scenario: Size-gate protection is not counted without policy

- **WHEN** a textual `toolResult` exceeds the `stale_large` token threshold but is not older than 15 DCP-ageable tool results
- **AND** the tool policy does not allow `stale_large`
- **THEN** DCP SHALL NOT count the result as protected by the `stale_large` age gate
