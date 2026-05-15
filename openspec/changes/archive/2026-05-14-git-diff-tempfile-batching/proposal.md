## Why

The `bash` tool inside Pi truncates output at 2000 lines or 50KB (whichever hits first). Three agent prompts (`commit.md`, `review.md`, `simplify.md`) invoke `git diff` / `gh pr diff` directly, and when diffs exceed the truncation limit the agent receives an incomplete picture of the changes — leading to missed context, poor commit messages, incomplete reviews, or incorrect simplifications.

## What Changes

- In `commit.md`, replace the per-file `git diff --cached -- <path>` strategy with a single `git diff --cached` command redirected to a `mktemp` file, read in batches via the `read` tool with offset/limit.
- In `review.md`, replace `git diff HEAD --stat`, per-file `git diff HEAD -- <file>`, and raw `gh pr diff [number]` with the same temp-file + batched-read pattern.
- In `simplify.md`, replace `git diff HEAD --stat` with the same pattern.
- Remove the `--stat` preflight step from all three prompts — the agent orients itself from the full diff instead.
- Remove per-file diff commands — no longer needed since the full diff is available in one file.

## Capabilities

### New Capabilities

- `git-diff-prompt-pattern`: The convention that any agent prompt running `git diff` or `gh pr diff` must redirect output to a temporary file created with `mktemp`, then read it in batches using the `read` tool with sequential offset/limit calls.

### Modified Capabilities

- None — no existing specs in `openspec/specs/` cover prompt behavior.

## Impact

- **Files modified**: `dotfiles/pi/agent/prompts/commit.md`, `dotfiles/pi/agent/prompts/review.md`, `dotfiles/pi/agent/prompts/simplify.md`
- **No code changes**: Only prompt markdown files are affected.
- **No breaking changes**: The external behavior (commit, review, simplify) is identical; only the internal diff-retrieval mechanism changes.
