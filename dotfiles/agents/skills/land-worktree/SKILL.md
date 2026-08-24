---
name: land-worktree
disable-model-invocation: true
description: Land a git worktree — push, merge PR, sync main, teardown environment.
---

# Land Worktree

Invoking this skill is the request and authorization to **land** the current linked worktree.

## Workflow

1. **Ground the worktree.**
   - Confirm `.git` is a file referencing `worktrees/`.
   - Record worktree path, branch, and primary clone path (first `git worktree list --porcelain` entry).
   - Complete when all three are identified.

2. **Push pending work.**
   - When the working tree is dirty, invoke the `commit` skill.
   - When the branch has unpushed commits only, run `git push`.
   - Complete when the branch is on the remote.

3. **Resolve the PR.**
   - Find the open PR for the branch (`gh pr view` or `gh pr list --head <branch> --json number,url`).
   - Complete when PR number and URL are known.

4. **Integrate the PR.**
   - Wait until every required check is green (`gh pr checks <number>`, `--watch` while pending).
   - Merge with `gh pr merge <number>`, preferring the repository default; `--squash` when unknown. Keep the branch on the remote.
   - Complete when the PR is merged and every required check was green before merge.

5. **Sync main in the primary clone.**
   - Check out the default branch and `git pull --ff-only` in the primary clone path.
   - Complete when `HEAD` matches `origin/<default-branch>`.

6. **Teardown.**
   - From the worktree path, detect a Compose project: `compose.yaml`, `compose.yml`, `docker-compose.yaml`, or `docker-compose.yml` at the root.
   - When none is present, set Teardown to `SKIPPED` and continue.
   - When present, run `docker compose down` in the worktree (stop containers and networks; leave volumes).
   - On non-zero exit, set Teardown to `FAILED` with the error and continue — teardown is best-effort.
   - Complete when Teardown is `OK`, `SKIPPED`, or `FAILED` in the landing report.

7. **Report.**
   - Print the landing report from Output.
   - Complete when printed.

## Failure

Stop and ask how to proceed on failure in steps 1–5. Print `Landing aborted at <step>: <error>`. Do not retry, amend, or force-push.

Steps 6–7 continue after teardown failure.

| Step | Condition             | Message                                        |
| ---- | --------------------- | ---------------------------------------------- |
| 1    | Not a linked worktree | `Not a linked worktree`                        |
| 3    | No open PR            | `No PR for branch <branch> — create one first` |
| 4    | Check failed          | Failing check names                            |
| 5    | Non-fast-forward      | Pull error detail                              |

## Preservation

Landing keeps the worktree directory and all branches intact. Operate in the primary clone only for step 5; report from the worktree path.

## Output

Success:

```
Landing complete

Push:      OK — <branch> → origin/<branch>
PR merge:  OK — <url>
Main sync: OK — <primary-clone-path> @ <sha>
Teardown:  OK | SKIPPED | FAILED — <detail>
Worktree:  <worktree-path>
```

Failure:

```
Landing aborted at <step>: <error>
```
