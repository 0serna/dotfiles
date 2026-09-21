---
name: land-pr
disable-model-invocation: true
description: Publish the current branch, merge its green pull request, and sync the primary clone.
metadata:
  opencode/autoinvoke: false

---

# Land pull request

Invoking this skill authorizes landing the pull request for the current branch.

## Workflow

1. **Identify the repository.**
   - Determine the current branch, remote default branch, and primary clone path from the first `git worktree list --porcelain` entry.

2. **Publish the branch.**
   - Inspect `git status --short` and the diff.
   - Stage and commit changes that belong to the branch with a concise message.
   - Push to the upstream, or set it with `git push -u origin <branch>`.

3. **Validate the pull request.**
   - Find the open PR for the current branch with `gh pr view --json number,url`.
   - Wait for required checks with `gh pr checks <number> --watch` when any are pending.

4. **Merge the pull request.**
   - Run `gh pr merge <number>`, following the repository default; use `--squash` when the strategy is unknown.

5. **Sync the primary clone.**
   - In the primary clone, check out the default branch and run `git pull --ff-only`.
   - Confirm `HEAD` matches `origin/<default-branch>`, then print the success report from the original checkout.

## Failure

Stop and ask how to proceed when a step fails. Print `Landing aborted at <step>: <error>`. Do not retry, amend, or force-push.

## Preservation

Keep every worktree and local or remote branch intact. Operate in the primary clone only while syncing it in step 5.

## Output

Success:

```
Landing complete

Push:      OK. <branch> to origin/<branch>
PR merge:  OK. <url>
Main sync: OK. <primary-clone-path> @ <sha>
```
