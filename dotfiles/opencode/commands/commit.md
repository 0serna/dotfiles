---
description: Generate commit for staged changes
---

## Task

Create a concise, factual commit message from staged changes and run the commit.

## Steps

1. Run:
   - `git status --short`
   - `git log --oneline -n 10`
   - `git diff --cached`
2. If `git diff --cached` is empty, print `No staged changes to commit` and stop.
3. Write the message using only facts visible in the diff.
4. Execute `git commit` using the generated message.
5. Output rules:
   - If commit succeeds, print only:
     - `Commit successful`
     - `<final committed message>`
   - If commit fails, print:
     - `Commit failed: <git error output>`
     - `Cause: <brief factual cause inferred from the error output>`
   - On failure, do not attempt to fix, retry, amend, or run additional corrective commands unless the user explicitly asks.

## Message rules

- Format: `<type>[scope]: <description>` + optional body
- Types: `feat|fix|refactor|docs|style|test|ci|build|chore|perf`
- Lowercase type, English only
- Scope is optional
- Subject is imperative, no trailing period/whitespace, <= 50 chars recommended
- Body is optional; if present, add one blank line after subject
- NEVER infer intent/benefits/causality beyond the diff

## Examples

```text
feat: add session refresh endpoint
```

```text
fix(parser): handle empty yaml frontmatter

- Return an error when closing delimiter is missing
- Preserve behavior for valid files
```
