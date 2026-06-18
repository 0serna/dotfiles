---
name: commit
description: >-
  Generate and run a concise conventional commit for staged changes when the
  user explicitly asks to commit, create a git commit, or finish a
  staged change as a commit. Do not use for requests that only ask to draft,
  suggest, or review a commit message.
---

# Commit

Create a concise, factual commit message from staged changes and run the commit. When this skill is active, proceed without asking for additional confirmation.

## Workflow

1. Treat this skill being active as authorization to create a commit; do not ask for additional confirmation.
2. Analyze only staged changes.
3. If there are no staged changes, print `No staged changes to commit` and stop.
4. Generate a commit message that follows the required format.
5. Run `git commit` with that message.
6. Report the final committed message or the failure cause.

## Rules

- Be fast; this task is not a long-running process.
- Never include unstaged or untracked changes in the commit analysis.
- When this skill is active, create the commit if staged changes exist.
- On failure, do not retry, amend, stage files, modify files, or ask to fix the failure.
- Commit format:
  - Follow conventional commits: `[type]([scope]): [description]` plus an optional body.
  - Scope is optional; if present, use modules or domains clearly defined in the project.
  - Body is optional; if present, add one blank line after the subject and prefer bullet points.
  - Description is imperative, has no trailing period or whitespace, and is no more than 50 characters.
  - Use lowercase type and English only.

## Output

On success, print:

```text
Commit successful
[committed message]
```

On failure, print:

```text
Commit failed
[cause from the error output]
```
