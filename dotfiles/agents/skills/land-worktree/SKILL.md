---
name: land-worktree
disable-model-invocation: true
description: Land a git worktree by pushing its changes, merging its green PR, and syncing the primary clone.
---

# Land worktree

Invoking this skill is the request and authorization to **land** the current linked worktree.

## Workflow

1. **Identify the worktree.**
   - Confirm `.git` is a file referencing `worktrees/`.
   - Record the worktree path, branch, and primary clone path. Use the first `git worktree list --porcelain` entry as the primary clone.
   - Complete when all three are identified.

2. **Publish the branch.**
   - Inspect `git status --short` and the diff.
   - When the working tree has changes that belong to the branch, stage them, commit them with a concise message, and push them.
   - Push the branch to its upstream. If it has no upstream yet, set it with `git push -u origin <branch>`.
   - Complete when the remote branch contains every branch change.

3. **Validate the pull request.**
   - Find the open PR with `gh pr view` or `gh pr list --head <branch> --json number,url`.
   - Wait until every required check is green. Use `gh pr checks <number>` and add `--watch` while checks are pending.
   - Complete when the PR number and URL are known and all required checks are green.

4. **Merge the pull request.**
   - Merge with `gh pr merge <number>`, following the repository default. Use `--squash` when the merge strategy is unknown.
   - Keep the remote branch.
   - Complete when the PR is merged.

5. **Sync the primary clone.**
   - Check out the default branch and `git pull --ff-only` in the primary clone path.
   - Complete when `HEAD` matches `origin/<default-branch>`.

6. **Report.**
   - Print the landing report from Output.
   - Complete when printed.

## Failure

Stop and ask how to proceed if a step fails. Print `Landing aborted at <step>: <error>`. Do not retry, amend, or force-push.

| Step | Condition             | Message                                        |
| ---- | --------------------- | ---------------------------------------------- |
| 1    | Not a linked worktree | `Not a linked worktree`                        |
| 3    | No open PR            | `No PR for branch <branch>. Create one first` |
| 3    | Check failed          | Failing check names                            |
| 5    | Non-fast-forward      | Pull error detail                              |

## Preservation

Landing keeps the worktree directory and all branches intact. Operate in the primary clone only for step 5; report from the worktree path.

## Output

Success:

```
Landing complete

Push:      OK. <branch> to origin/<branch>
PR merge:  OK. <url>
Main sync: OK. <primary-clone-path> @ <sha>
Worktree:  <worktree-path>
```

Failure:

```
Landing aborted at <step>: <error>
```
