---
description: Generate commit for staged changes
---

Create a concise, factual commit message from the staged changes and run the commit, reporting either the final committed message or the failure cause.

## Workflow

1. Analyze ONLY staged changes.
2. Generate a commit message for the changes.

## Rules

- **Be fast**; this task is not a long-running process.
- If no staged changes, print `No staged changes to commit` and stop.
- On failure, do not retry or amend unless the user asks.
- Commit format:
  - Follow the conventional commits `[type]([scope]): [description]` plus an optional body.
  - Scope is optional; if present, use modules or domains clearly defined in the project.
  - Body is optional; if present, add one blank line after the subject and prefer bullet points.
  - Description is imperative, has no trailing period or whitespace, and is no more than 50 characters.
  - Use lowercase type and English only.

## Output

- On success, print:

  Commit successful
  [committed message]

- On failure, print:

  Commit failed
  [cause from the error output]
