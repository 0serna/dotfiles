## MODIFIED Requirements

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only eligible `toolResult` messages that match explicit tool/mechanism pruning policy entries and whose estimated original output size is greater than 1000 tokens. The allowed pruning mechanisms are `duplicate`, `resolved`, `superseded`, and `stale_large`. Tools without an explicit pruning policy entry SHALL be excluded from pruning, pruning metrics, and DCP age calculations. File operation tools MAY be stubbed by the `stale_large` rule when their policy allows it, except explicit skill reads (`SKILL.md`) SHALL NOT be stubbed by `stale_large`. File operation tools SHALL NOT be stubbed by the `duplicate` rule. DCP SHALL use non-truncated semantic operation identities for `resolved` and `superseded` decisions, while display targets MAY be truncated for logs. DCP SHALL treat `duplicate` as a global normalized-text mechanism independent of operation identity for non-file tools that allow it. For every applied pruning decision, DCP SHALL replace the result content with a minimal stub containing the pruning reason and a saved file path. When a bash result text contains a Pi `Full output:` path for a readable `/tmp/pi-bash-*.log` file, DCP SHALL use that existing path as the saved file path without creating a DCP-owned copy or changing that file's permissions. Otherwise, DCP SHALL write the original result content to a temporary per-session file and use that DCP-owned file as the saved path. DCP SHALL NOT apply a pruning decision when the replacement stub would not reduce the estimated token count.

#### Scenario: Tool without pruning policy is excluded from DCP

- **WHEN** DCP evaluates a textual `toolResult` for a tool with no explicit pruning policy entry
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Ignored tool is excluded from DCP

- **WHEN** DCP evaluates a `toolResult` for an ignored tool such as `question` or `multi_tool_use.parallel`
- **THEN** DCP SHALL leave the result unchanged and SHALL NOT count it in pruning metrics or DCP age calculations

#### Scenario: Duplicate output is stubbed for allowlisted tool

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **AND** the result has an estimated original output size greater than 1000 tokens
- **AND** the tool policy allows `duplicate`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original result content
- **AND** DCP SHALL replace the duplicate result content with a minimal stub containing `reason=duplicate` and the saved file path

#### Scenario: Duplicate output below threshold is preserved

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **AND** the result has an estimated original output size of 1000 tokens or less
- **AND** the tool policy allows `duplicate`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Duplicate output is preserved without policy

- **WHEN** a `toolResult` has the same normalized content as an earlier kept tool result
- **AND** the tool policy does not allow `duplicate`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Duplicate file tool output is preserved

- **WHEN** a `read`, `edit`, or `write` `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL leave the result content unchanged for the `duplicate` reason

#### Scenario: Resolved error is stubbed for allowlisted tool

- **WHEN** an error `toolResult` is followed by a later successful result for the same semantic operation identity
- **AND** the error result has an estimated original output size greater than 1000 tokens
- **AND** the tool policy allows `resolved`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original error content
- **AND** DCP SHALL replace the error result content with a minimal stub containing `reason=resolved` and the saved file path

#### Scenario: Resolved error below threshold is preserved

- **WHEN** an error `toolResult` is followed by a later successful result for the same semantic operation identity
- **AND** the error result has an estimated original output size of 1000 tokens or less
- **AND** the tool policy allows `resolved`
- **THEN** DCP SHALL leave the error result content unchanged

#### Scenario: Resolved error is preserved without policy

- **WHEN** an error `toolResult` is followed by a later successful result for the same semantic operation identity
- **AND** the tool policy does not allow `resolved`
- **THEN** DCP SHALL leave the error result content unchanged

#### Scenario: Read results with different ranges are not the same resolved operation

- **WHEN** an error `read` result for a file path and one `offset` or `limit` value is followed by a successful `read` result for the same file path with a different `offset` or `limit` value
- **THEN** DCP SHALL NOT replace the error result content for the `resolved` reason

#### Scenario: Same-tool superseded write result is stubbed for allowlisted tool

- **WHEN** a `write` `toolResult` targets a path that is targeted by a later `write` operation with the same normalized path
- **AND** the older result has an estimated original output size greater than 1000 tokens
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original older result content
- **AND** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded` and the saved file path

#### Scenario: Read result with same range is superseded

- **WHEN** a `read` `toolResult` targets a path, `offset`, and `limit` that are targeted by a later `read` operation with the same normalized path, `offset`, and `limit`
- **AND** the older result has an estimated original output size greater than 1000 tokens
- **AND** the tool policy allows `superseded`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original older result content
- **AND** DCP SHALL replace the older result content with a minimal stub containing `reason=superseded` and the saved file path

#### Scenario: Superseded file result below threshold is preserved

- **WHEN** a file `toolResult` targets a semantic operation identity that is targeted by a later operation with the same normalized tool and same semantic operation identity
- **AND** the older result has an estimated original output size of 1000 tokens or less
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

- **WHEN** a textual `toolResult` is older than 30 DCP-ageable tool results and has an estimated size greater than 1000 tokens
- **AND** the tool policy allows `stale_large`
- **AND** the replacement stub would reduce the estimated token count
- **THEN** DCP SHALL save a recovery path for the original result content
- **AND** DCP SHALL replace the result content with a minimal stub containing `reason=stale_large` and the saved file path

#### Scenario: Stale large textual tool result is preserved without policy

- **WHEN** a textual `toolResult` is older than 30 DCP-ageable tool results and has an estimated size greater than 1000 tokens
- **AND** the tool policy does not allow `stale_large`
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Large textual tool result inside age gate is preserved from size-only pruning

- **WHEN** a textual `toolResult` is not older than 30 DCP-ageable tool results and only qualifies for `stale_large` pruning
- **THEN** DCP SHALL leave the result content unchanged

#### Scenario: Stale large file operation is stubbed when policy allows it

- **WHEN** a `read`, `edit`, or `write` `toolResult` only qualifies for size-based pruning
- **AND** the result is older than 30 DCP-ageable tool results
- **AND** the result has an estimated original output size greater than 1000 tokens
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
