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

1. Identify the current branch, remote default branch, and primary clone path from the first `git worktree list --porcelain` entry.
2. Run `gh pr view --json number,url` for the current branch. Record an open PR's number and URL and skip step 3. A missing PR is not a failure.
3. If no open PR exists:
   - Inspect `git status --short` and the diff. Stage and commit changes that belong to the branch with a concise message.
   - Push to the upstream, setting it with `git push -u origin <branch>` when missing.
   - Call the Skill tool with `pr` to write the body using the branch diff and observed evidence. Create the PR with `gh pr create` using that body, then record its number and URL.
4. Align the branch with the default branch:
   - Run `git fetch origin <default-branch>`, then `git merge origin/<default-branch>` and push with `git push origin <branch>`.
   - Resolve conflicts directly only when both sides are preserved without a behavior choice, such as disjoint additions, whitespace, formatting, or import order. For competing logic or deletion of changed code, ask the user before resolving. Push the resolved merge.
   - Done when `origin/<default-branch>` is an ancestor of `HEAD` and `HEAD` matches `origin/<branch>`.
5. Wait for required checks to pass, using `gh pr checks <number> --watch` when any are pending.
6. Run `gh pr merge <number>` with the repository default strategy; use `--squash` when unknown.
7. In the primary clone, check out the default branch and run `git pull --ff-only`. Confirm `HEAD` matches `origin/<default-branch>`, then report success from the original checkout.

## Failure

On failure, print `Landing aborted at <step>: <error>` and ask how to proceed. Do not retry, amend, or force-push. The step 4 conflict question resumes the workflow after applying the user's answer and pushing the resolved merge.

## Preservation

Keep every worktree and local or remote branch intact. Operate in the primary clone only while syncing it in step 7.

## Output

Report `Landing complete`, the branch, merged PR URL, and primary clone path with its synced commit SHA.
