## MODIFIED Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only eligible `toolResult` messages that match explicit tool/mechanism pruning policy entries and whose estimated original output size is greater than 500 tokens. The allowed pruning mechanisms are `superseded` and `stale_large`. Tools without an explicit pruning policy entry SHALL be excluded from pruning, pruning metrics, and DCP age calculations. File operation tools MAY be stubbed by the `stale_large` rule when their policy allows it, except explicit skill reads (`SKILL.md`) SHALL NOT be stubbed by `stale_large`. DCP SHALL use non-truncated semantic operation identities for `superseded` decisions, while display targets MAY be truncated for logs. DCP SHALL replace the result content with a minimal stub containing the pruning reason and a saved file path. When a bash result text contains a Pi `Full output:` path for a readable `/tmp/pi-bash-*.log` file, DCP SHALL use that existing path as the saved file path without creating a DCP-owned copy or changing that file's permissions. Otherwise, DCP SHALL write the original result content to a temporary per-session file and use that DCP-owned file as the saved path. DCP SHALL NOT apply a pruning decision when the replacement stub would not reduce the estimated token count.

#### Scenario: Tool without pruning policy is excluded from DCP

- **WHEN** DCP evaluates a textual `toolResult` for a tool with no explicit pruning policy entry
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Ignored tool is excluded from DCP

- **WHEN** DCP evaluates a `toolResult` for an ignored tool such as `question` or `multi_tool_use.parallel`
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Same-tool superseded write result is stubbed for allowlisted tool

- **WHEN** a `write` `toolResult` targets a path that is targeted by a later `write` operation with the same normalized path
- **AND** the older result has an estimated original output size greater than 500 tokens
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original older result content
- **AND** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded` and the saved file path

#### Scenario: Read result with same range is superseded

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit` that are targeted by a later `read` operation with the same normalized path, `offset`, and `limit`
- **AND** the older result has an estimated original output size greater than 500 tokens
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original older result content
- **AND** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded` and the saved file path

#### Scenario: Superseded file result below threshold is preserved

- **WHEN** a file `toolResult` targets a semantic operation identity that is targeted by a later operation with the same normalized tool and same semantic operation identity
- **AND** the older result has an estimated original output size of 500 tokens or less
- **AND** the tool policy allows `superseded`
- **THEN** DCP SHALL leave the older result content unchanged

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

- **WHEN** a textual `toolResult` is older than 25 DCP-ageable tool results and has an estimated size greater than 500 tokens
- **AND** the tool policy allows `stale_large`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original result content
- **AND** DCP SHALL replace the result content with a minimal stub containing `reason=stale_large` and the saved file path

#### Scenario: Stale large textual tool result is preserved without policy

- **WHEN** a textual `toolResult` is older than 25 DCP-ageable tool results and has an estimated size greater than 500 tokens
- **AND** the tool policy does not allow `stale_large`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Large textual tool result inside age gate is preserved from size-only pruning

- **WHEN** a textual `toolResult` is not older than 25 DCP-ageable tool results and only qualifies for `stale_large` pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Stale large file operation is stubbed when policy allows it

- **WHEN** a `read`, `edit`, or `write` `toolResult` only qualifies for size-based pruning
- **AND** the result is older than 25 DCP-ageable tool results
- **AND** the result has an estimated original output size greater than 500 tokens
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original result content
- **AND** DCP SHALL replace the result content with a minimal stub containing `reason=stale_large` and the saved file path

#### Scenario: Existing Pi bash full-output path is reused

- **WHEN** DCP applies a pruning decision to a bash `toolResult` that contains a Pi `Full output:` marker referencing a readable `/tmp/pi-bash-*.log` path
- **THEN** DCP SHALL use that existing path in the replacement stub's `saved=` field
- **AND** DCP SHALL NOT create a DCP-owned copy for that pruned result
- **AND** DCP SHALL NOT change permissions on the existing file

#### Scenario: Missing full-output path falls back to DCP-owned file

- **WHEN** DCP applies a pruning decision to a bash `toolResult` that contains a Pi `Full output:` marker referencing a missing path
- **THEN** DCP SHALL write the original result content to a temporary per-session file
- **AND** DCP SHALL use the DCP-owned file path in the replacement stub's `saved=` field

#### Scenario: Stale large skill read is preserved

- **WHEN** a `read` `toolResult` for a `SKILL.md` path only qualifies for size-based pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Non-saving stub is not applied

- **WHEN** a pruning decision matches an allowed pruning mechanism and exceeds the token threshold
- **AND** the replacement stub would not reduce the estimated token count
- **THEN** DCP SHALL leave the result content unchanged
- **AND** DCP SHALL NOT count the decision as stubbed in pruning metrics

## REMOVED Requirements

### Requirement: Duplicate output pruning

**Reason**: The `duplicate` mechanism is removed in this change; recent activity shows it produces mostly short collisions below the size gate and adds normalized-hash bookkeeping for negligible savings.
**Migration**: Replaced output deduplication is no longer provided. The remaining `superseded` and `stale_large` mechanisms cover the high-value cases.

### Requirement: Resolved error pruning

**Reason**: The `resolved` mechanism is removed in this change; bash error-then-success sequences are typically short and the semantic-operation identity bookkeeping is no longer justified.
**Migration**: Replaced error trimming is no longer provided. The remaining `superseded` and `stale_large` mechanisms cover the high-value cases.

## RENAMED Requirements

### Requirement: Stale-large age metrics → Age-gated size protection metrics

**Reason**: The metric `staleLargeProtectedCount` is renamed to `ageGatedCount` to reflect that the size gate (now 500 tokens) and the age gate (now 25) are independent, and that the metric counts candidates that cleared the size gate but were blocked by the age gate.
**Migration**: External readers of `PruneMetrics` must use the new field name `ageGatedCount`. The semantic and counting rules are unchanged apart from the threshold/age values.
