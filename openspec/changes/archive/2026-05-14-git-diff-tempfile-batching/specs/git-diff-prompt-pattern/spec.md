## ADDED Requirements

### Requirement: Agent prompts SHALL redirect git diff output to a temp file

When an agent prompt needs to inspect the output of `git diff` or `gh pr diff`, it SHALL NOT rely on the direct stdout of the `bash` tool. Instead, it SHALL:

1. Create a temporary file using `mktemp` and capture the path.
2. Redirect the diff command output into that file.
3. Use the `read` tool with `offset` and `limit` parameters to consume the file in batches.
4. Iterate through batches until the file is fully consumed.

#### Scenario: Full diff is captured without truncation

- **WHEN** a prompt runs `git diff HEAD` and the output exceeds 3000 lines
- **THEN** the prompt SHALL capture the complete diff in a temp file and read it in multiple batches, with no content loss due to truncation.

#### Scenario: Empty diff is handled gracefully

- **WHEN** a prompt runs `git diff --cached` and there are no staged changes
- **THEN** the temp file is empty, and the agent detects this on the first `read` call.

#### Scenario: gh pr diff follows the same pattern

- **WHEN** reviewing a pull request via `gh pr diff [number]`
- **THEN** the same temp-file + batched-read pattern SHALL be used.

### Requirement: Batching loop SHALL use sequential offsets

The agent SHALL start reading at `offset=1`. After each batch, if the file may have more content, the agent SHALL continue at `offset = previous_offset + lines_read` (or `offset + 2000` as an approximation).

#### Scenario: Multi-batch read completes correctly

- **WHEN** the diff file contains 4500 lines
- **THEN** the agent reads batch 1 (lines 1–2000), batch 2 (lines 2001–4000), and batch 3 (lines 4001–4500), combining the results.

### Requirement: Per-file diffs and --stat SHALL be removed

Prompts SHALL NOT issue separate `git diff --stat` or `git diff --cached -- <path>` commands. The single full diff replaces both.

#### Scenario: No per-file diff commands issued

- **WHEN** reviewing local changes
- **THEN** the prompt SHALL NOT run `git diff HEAD -- <file>` for individual files.
