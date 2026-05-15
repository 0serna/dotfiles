## 1. Update commit.md

- [x] 1.1 Replace the per-file diff inspection workflow with the temp-file + batched-read pattern
- [x] 1.2 Remove the `--stat` preflight step and per-file `git diff --cached -- <path>` commands
- [x] 1.3 Ensure the empty-diff check is implicit (first read returns empty → "No staged changes to commit")

## 2. Update review.md

- [x] 2.1 Replace local-diff workflow: remove `git diff HEAD --stat` and per-file `git diff HEAD -- <file>`, add temp-file pattern for `git diff HEAD`
- [x] 2.2 Replace PR-diff workflow: redirect `gh pr diff [number]` to temp file instead of reading raw stdout
- [x] 2.3 Ensure the empty-diff check is implicit (first read returns empty → "No changes to review")

## 3. Update simplify.md

- [x] 3.1 Replace `git diff HEAD --stat` with the temp-file + batched-read pattern for the full diff
- [x] 3.2 Remove the stat-dependent file selection logic

## 4. Verify consistency

- [x] 4.1 Confirm no `git diff` commands remain that pipe output directly to agent stdout in any prompt
- [x] 4.2 Confirm the temp-file pattern is identical across all three prompts (copy-paste consistent)
