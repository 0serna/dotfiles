---
name: commit
disable-model-invocation: true
description: Execute a conventional commit from staged changes.
---

# Commit

Execute a concise, factual conventional commit from staged changes only.

## Invocation contract

When this skill is invoked, do not summarize the skill, explain the workflow, or ask whether to proceed. Start the workflow immediately.

## Workflow

1. Run `git diff --cached --stat` and `git diff --cached` to inspect staged changes; complete when every staged change is accounted for in the message decision.
2. If there are no staged changes, print `No staged changes to commit` and stop.
3. Generate a commit message that follows the required format.
4. Run `git commit` with that message without asking for confirmation; complete only when the tool result reports success.
5. Report success only after step 4 completes. If `git commit` was not executed, do not report success.

## Message format

- Use English only.
- Follow conventional commits: `[type]([scope]): [description]` plus an optional body.
- Use lowercase type.
- Scope is optional; if present, use modules or domains clearly defined in the project.
- Description is imperative, has no trailing period or whitespace, and is no more than 50 characters.
- Body is optional; if present, add one blank line after the subject and prefer bullet points.

## Failure rule

On failure, or if `git commit` cannot be executed, do not retry, amend, stage files, or modify files. Ask the user how to proceed.

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
