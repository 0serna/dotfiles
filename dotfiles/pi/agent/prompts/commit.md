---
description: Generate commit for staged changes
---

Create a concise, factual commit message from the staged changes and run the commit once, reporting either the final committed message or the factual failure cause.

## Workflow

1. Run `git diff --cached && git log -10 --oneline` to get the staged changes and recent commit style, then read the outputs. If the diff is large, read in batches.
2. Generate a message using only facts visible in the diff.
3. Run `git commit -m "[generated message]" && git log -1` to commit and confirm in one command.

## Rules

- Do not use the `advisor` tool for this task; inspect the staged diff, choose the commit message, and run the commit independently.
- If there are no staged changes (`git diff --cached` is empty), print `No staged changes to commit` and stop.
- On failure, do not retry, amend, or run corrective commands unless the user asks.
- Format commit messages as `[type]([scope]): [description]` plus an optional body.
- Use one of these types: `feat|fix|refactor|docs|style|test|ci|build|chore|perf`.
- Scope is optional; if present, use modules or domains clearly defined in the project.
- Body is optional; if present, add one blank line after the subject and use bullet points.
- Subject is imperative, has no trailing period or whitespace, and is no more than 50 characters.
- Use lowercase type and English only.

## Output

- On success, print:

  ```text
  Commit successful
  `[final committed message]`
  ```

- On failure, print:

  ```text
  Commit failed
  [brief factual cause from the error output]
  ```
