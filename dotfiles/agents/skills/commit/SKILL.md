---
name: commit
disable-model-invocation: true
description: Create a conventional commit from staged changes.
---

# Commit

Create a concise, factual conventional commit from staged changes only.

## Workflow

1. Inspect staged changes.
2. If there are no staged changes, print `No staged changes to commit` and stop.
3. Generate a commit message that follows the required format.
4. Run `git commit` with that message without asking for confirmation.
5. Report the committed message or the failure cause.

## Message format

- Use English only.
- Follow conventional commits: `[type]([scope]): [description]` plus an optional body.
- Use lowercase type.
- Scope is optional; if present, use modules or domains clearly defined in the project.
- Description is imperative, has no trailing period or whitespace, and is no more than 50 characters.
- Body is optional; if present, add one blank line after the subject and prefer bullet points.

## Failure rule

On failure, do not retry, amend, stage files, or modify files. Ask the user how to proceed.

## Output

Success:

```text
Commit successful
[committed message]
```

Failure:

```text
Commit failed
[cause from the error output]
```
