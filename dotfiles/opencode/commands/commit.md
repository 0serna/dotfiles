---
description: Generate commit for staged changes
model: opencode-go/minimax-m2.7
subtask: true
---

## Arguments

No arguments expected.

## Task

Create a concise, factual commit message from staged changes and run the commit.

## Workflow

1. Run `git diff --cached`. If empty, print `No staged changes to commit` and stop.
2. Generate a message using only facts visible in the diff.
3. Run `git commit` with the generated message.

## Rules

- On failure, do not retry, amend, or run corrective commands unless the user asks.
- Format commit messages as `[type][scope]: [description]` plus an optional body.
- Use one of these types: `feat|fix|refactor|docs|style|test|ci|build|chore|perf`.
- Scope is optional; if present, use modules or domains clearly defined in the project.
- Body is optional; if present, add one blank line after the subject.
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
