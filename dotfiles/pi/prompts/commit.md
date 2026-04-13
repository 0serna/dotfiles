---
description: Create a factual commit from staged changes
---

Create one or more git commits for the current changes.

This prompt is explicit user authorization, for this request only, to inspect the current Git working tree, reorganize staging if needed, and create the commit or commits required to group the current changes well. This authorization is limited to the current changes in this request and does **not** persist afterward. It does **not** authorize pushing, rebasing, amending, editing files, or other unrelated Git operations.

## Decision policy

Choose the safest valid path:

- If the current changes form one coherent change, create exactly one commit.
- If the current changes clearly split into multiple independent, factual groups, you may reorganize staging and create multiple commits.
- If the grouping is ambiguous, risky, or would require guessing intent, do not commit anything. Instead, stop and present a proposed commit plan for the user to confirm.

## Steps

1. Run:
   - `git status --short`
   - `git diff`
   - `git diff --cached`
   - `git log -n 30 --pretty=format:%s`
2. If both staged and unstaged diffs are empty, print `No changes to commit` and stop.
3. Before committing, identify the most relevant project quality gate for the current repository and run it once to catch obvious pre-commit failures early.
   - Prefer existing project scripts or documented commands.
   - Common examples include `npm run check`, `npm run lint`, or the repository's documented validation command.
   - If no clear quality gate exists, continue without one.
   - If the quality gate fails, stop and report the failure instead of committing.
4. Analyze all current changes and classify the situation as one of:
   - `single`: one coherent change
   - `split-safe`: multiple clearly independent groups
   - `ambiguous`: unclear grouping, mixed intent, or too many unrelated changes
5. If the result is `ambiguous`, do not make any commit. Output a concise proposed grouping plan and stop.
6. If the result is `single`, stage only the intended current changes if needed and create exactly one commit.
7. If the result is `split-safe`, you may reorganize staging and create multiple commits.
8. After each successful commit, continue only with the remaining changes that clearly belong to another already-identified group.
9. Output rules:
   - If one commit succeeds, print only:
     - `Commit successful`
     - `<final committed message>`
   - If multiple commits succeed, print only:
     - `Commits successful`
     - one line per committed message in execution order
   - If the operation stops because grouping is ambiguous, print:
     - `Commit plan required`
     - a short proposed grouping list
   - If a commit fails, print:
     - `Commit failed: <git error output>`
     - `Cause: <brief factual cause inferred from the error output>`
   - On failure, do not attempt to fix, retry, amend, push, or run additional corrective commands unless the user explicitly asks.

## Message rules

- Format: `<type>(<scope>): <summary>` or `<type>: <summary>`
- Types: `feat|fix|refactor|docs|style|test|ci|build|chore|perf`
- `type` is required, lowercase, and in English
- `scope` is optional and should be a short noun for the affected area when it adds clarity
- `summary` is required, imperative, no trailing period or whitespace, and 72 chars or fewer
- Body is optional; if needed, add one blank line after the subject and use short factual paragraphs or bullets
- Do not add breaking-change markers, trailers, sign-offs, or references not visible in the staged diff
- Never infer intent, benefits, causality, or hidden work beyond what is visible in the staged diff
- Prefer the smallest truthful scope that matches the staged changes
- Use the recent commit subjects only as style hints, not as evidence

## Guardrails

- You may use `git add`, `git add -p`, `git restore --staged`, or `git reset -p` only as needed to organize the current changes into clear commits
- Never edit files while doing commit organization
- Never use `git push`, `git commit --amend`, `git rebase`, `git reset --hard`, `git checkout --`, or `git clean -fd`
- Do not create commits that are unnecessarily tiny, mechanically fragmented, or lacking standalone value
- Prefer the smallest set of commits that preserves coherent reviewable units
- If a clean grouping is not obvious, stop and ask for confirmation through a proposed plan instead of guessing
- Each commit must be factual, scoped to one coherent change, and supported by the actual diff
