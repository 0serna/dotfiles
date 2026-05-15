---
description: Generate commit for staged changes
---

Create a concise, factual commit message from the staged changes and run the commit once, reporting either the final committed message or the factual failure cause.

## Workflow

1. Run `DIFF_FILE=$(mktemp) && git diff --cached > "$DIFF_FILE" && echo "Diff file: $DIFF_FILE" && git log -10 --oneline` to save the full staged diff to a temp file and show recent commit style.
2. Read the temp file using the `read` tool with `offset=1, limit=2000`. Continue with `offset=2001`, `offset=4001`, and so on until the file is fully consumed. If the first read returns empty, there are no staged changes.
3. Generate a message using only facts visible in the diff, then run `git commit -m "[generated message]" && git log -1` to commit and confirm in one command.

## Rules

- Do not use the `advisor` tool for this task; inspect the staged diff, choose the commit message, and run the commit independently.
- If the diff file is empty (first read returns no content), print `No staged changes to commit` and stop.
- On failure, do not retry or amend unless the user asks.
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
