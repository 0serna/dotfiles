## MODIFIED Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only eligible `toolResult` messages that match explicit tool/mechanism pruning policy entries. The allowed pruning mechanisms are `superseded` and `stale_large`. Tools without an explicit pruning policy entry SHALL be excluded from pruning, pruning metrics, and DCP age calculations. File operation tools MAY be stubbed by the `stale_large` rule when their policy allows it, except explicit skill reads (`SKILL.md`) SHALL NOT be stubbed by `stale_large`. DCP SHALL use non-truncated semantic operation identities for `superseded` decisions, while display targets MAY be truncated for logs. DCP SHALL replace the result content with a minimal stub containing the pruning reason. When a bash result text contains a Pi `Full output:` path for a readable `/tmp/pi-bash-*.log` file, DCP SHALL use that existing path as the saved file path in the stub's `saved=` field. Otherwise, the stub SHALL NOT include a `saved=` field. DCP SHALL NOT apply a pruning decision when the replacement stub would not reduce the estimated token count.

#### Scenario: Tool without pruning policy is excluded from DCP

- **WHEN** DCP evaluates a textual `toolResult` for a tool with no explicit pruning policy entry
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Ignored tool is excluded from DCP

- **WHEN** DCP evaluates a `toolResult` for an ignored tool such as `question` or `multi_tool_use.parallel`
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Same-tool superseded write result is stubbed for allowlisted tool

- **WHEN** a `write` `toolResult` targets a path that is targeted by a later `write` operation with the same normalized path
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded`

#### Scenario: Read result with same range is superseded

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit` that are targeted by a later `read` operation with the same normalized path, `offset`, and `limit`
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded`

#### Scenario: Superseded file result is preserved without policy

- **WHEN** a file `toolResult` targets a semantic operation identity that is targeted by a later operation with the same normalized tool and same semantic operation identity
- **AND** the tool policy does not allow `superseded`
- **THEN** DCP SHALL leave the older result content unchanged

#### Scenario: Read result with different range is preserved from superseded pruning

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit`
- **AND** a later `read` operation targets the same normalized path with a different `offset` or `limit`
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Edit result is preserved from superseded pruning

- **WHEN** an `edit` `toolResult` targets a path that is targeted by a later `edit` operation
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Different-tool file operation is not superseded

- **WHEN** a file `toolResult` targets a path that is targeted by a later file operation with a different normalized tool
- **THEN** DCP SHALL NOT replace the older result content for the `superseded` reason

#### Scenario: Stale tool result is stubbed for allowlisted tool after age gate

- **WHEN** a textual `toolResult` is older than 25 DCP-ageable tool results
- **AND** the tool policy allows `stale_large`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL replace the result content with a minimal stub containing `reason=stale_large`

#### Scenario: Stale tool result is preserved without policy

- **WHEN** a textual `toolResult` is older than 25 DCP-ageable tool results
- **AND** the tool policy does not allow `stale_large`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Tool result inside age gate is preserved

- **WHEN** a textual `toolResult` is not older than 25 DCP-ageable tool results
- **AND** only qualifies for `stale_large` pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Stale skill read is preserved

- **WHEN** a `read` `toolResult` for a `SKILL.md` path only qualifies for `stale_large` pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Existing Pi bash full-output path is reused

- **WHEN** DCP applies a pruning decision to a bash `toolResult` that contains a Pi `Full output:` marker referencing a readable `/tmp/pi-bash-*.log` path
- **THEN** DCP SHALL use that existing path in the replacement stub's `saved=` field
- **AND** DCP SHALL NOT create a DCP-owned copy for that pruned result
- **AND** DCP SHALL NOT change permissions on the existing file

#### Scenario: Missing full-output path omits saved field

- **WHEN** DCP applies a pruning decision to a bash `toolResult` that does not contain a Pi `Full output:` marker or references a missing path
- **THEN** DCP SHALL replace the result content with a minimal stub without a `saved=` field

#### Scenario: Non-saving stub is not applied

- **WHEN** a pruning decision matches an allowed pruning mechanism
- **AND** the replacement stub would not reduce the estimated token count
- **THEN** DCP SHALL leave the result content unchanged
- **AND** DCP SHALL NOT count the decision as stubbed in pruning metrics

## REMOVED Requirements

### Requirement: Age-gated size protection metrics

**Reason**: The 500-token size threshold has been removed. `stale_large` now applies based on age only, making this metric unnecessary.

**Migration**: No migration needed. The `ageGatedCount` metric is no longer reported.

## MODIFIED Requirements

### Requirement: Stable pruning interface

DCP SHALL expose context pruning behavior through a single stable pruning interface that accepts the current context messages and pruning options, returns transformed messages and metrics, and preserves all existing pruning-rule behavior behind that interface. If pruning encounters an unexpected internal error, DCP SHALL leave the input messages unchanged and SHALL return empty pruning metrics rather than interrupting context processing.

#### Scenario: Pruning succeeds through stable interface

- **WHEN** context messages are passed through the pruning interface
- **THEN** DCP SHALL return a messages array and pruning metrics according to the existing pruning rules

#### Scenario: Internal pruning failure is fail-open

- **WHEN** an unexpected internal pruning error occurs while processing context messages
- **THEN** DCP SHALL return the original messages unchanged
- **AND** DCP SHALL return empty pruning metrics
