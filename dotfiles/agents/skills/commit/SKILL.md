---
name: commit
disable-model-invocation: true
description: Commit staged changes, or stage all changes first, then push.
---

# Commit

Invoking this skill is the request and authorization to commit and push immediately. Begin in **current-index mode**. Switch to **stage-all mode** only when the user text appended after this skill block is exactly `all`.

## Workflow

1. Read only the user text appended after the skill block as arguments:
   - Empty: current-index mode; use the index as-is.
   - Exactly `all`: stage-all mode; run `git add --all`.

   Complete when the selected mode is applied. Words inside this skill block are instructions, never arguments.

2. Run `git diff --cached --stat` and `git diff --cached` to inspect staged changes; complete when every staged change is reflected in the message decision.
3. If there are no staged changes, print `No staged changes` and stop.
4. Generate a conventional commit message from the staged diff; complete when the message follows every rule in Message format.
5. Run `git commit` with that message; complete when the tool result reports success.
6. Run `git push`; complete when the tool result reports success.
7. Print the commit subject and push summary.

## Message format

- English only.
- Conventional commits: `type(scope): description`, optional body.
- Type is lowercase.
- Scope is optional; use project modules or domains when present.
- Description is imperative, ≤50 characters, ends with a letter or digit.
- Body: one blank line after subject, prefer bullet points.

## Failure

On commit or push failure, print the error and ask the user how to proceed. Do not retry, amend, stage, or modify files.

## Output

Success:

```
Committed: type(scope): description
Pushed: branch → remote/branch
```

Failure:

```
Commit failed: <error>
```

or

```
Push failed: <error>
```
