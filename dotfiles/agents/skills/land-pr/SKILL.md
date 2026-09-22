---
name: land-pr
disable-model-invocation: true
description: Land the current branch pull request, publishing and aligning it with the default branch first, and sync the primary clone.
metadata:
  opencode/autoinvoke: false

---

# Land pull request

Invoking this skill authorizes landing the pull request for the current branch.

## Workflow

1. **Identify the repository.**
   - Determine the current branch, remote default branch, and primary clone path from the first `git worktree list --porcelain` entry.

2. **Check for an open pull request.**
   - Run `gh pr view --json number,url` for the current branch.
   - Open PR found: record its number and url, continue to step 4.
   - No open PR: continue to step 3. Treat a missing PR here as the signal to continue to step 3.

3. **Publish the branch (no open PR only).**
   - Inspect `git status --short` and the diff.
   - Stage and commit changes that belong to the branch with a concise message.
   - Push to the upstream, or set it with `git push -u origin <branch>`.
   - Create the pull request with `gh pr create`, then record its number and url.

4. **Align the branch with the default branch.**
   - Run `git fetch origin <default-branch>`, then `git merge origin/<default-branch>` and push with `git push origin <branch>`.
   - Done when `origin/<default-branch>` is an ancestor of `HEAD` and `HEAD` matches `origin/<branch>`.
   - Resolve a conflict directly only when the merge preserves both sides without choosing behavior: disjoint additions, whitespace, formatting, or import order. Push the result and continue to step 5.
   - When the conflict edits the same logic on both sides, deletes code the other side changes, or requires a behavior choice, stop and ask the user how to resolve it. Apply the answer, push, then continue to step 5.

5. **Validate the pull request.**
   - Use the number and url recorded in step 2 or 3.
   - Wait for required checks with `gh pr checks <number> --watch` when any are pending.

6. **Merge the pull request.**
   - Run `gh pr merge <number>`, following the repository default; use `--squash` when the strategy is unknown.

7. **Sync the primary clone.**
   - In the primary clone, check out the default branch and run `git pull --ff-only`.
   - Confirm `HEAD` matches `origin/<default-branch>`, then print the success report from the original checkout.

## Failure

Stop and ask how to proceed when a step fails. Print `Landing aborted at <step>: <error>`. Do not retry, amend, or force-push. The step 4 conflict question is the exception: it resumes at step 5 after applying the user's answer.

## Preservation

Keep every worktree and local or remote branch intact. Operate in the primary clone only while syncing it in step 7.

## Output

Success:

```
Landing complete

Push:        OK. <branch> to origin/<branch> (or SKIPPED, open PR already existed)
Branch sync: OK. <branch> contains origin/<default-branch>
PR merge:    OK. <url>
Main sync:   OK. <primary-clone-path> @ <sha>
```
