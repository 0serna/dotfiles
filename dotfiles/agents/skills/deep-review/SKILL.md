---
name: deep-review
description: "Deep review of one change: comment cleanup, four-lens review, senior review, one merged report."
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false

---

# Deep review

Three reviews on one change, each in a subagent, then one report. Cleanup runs first, so both reviews see the final code.

Scope: a diff, a PR, a branch, or files the caller names. Nothing named: the working tree; when it is clean, `git diff main...HEAD`. Resolve it once and pass the same text to every subagent. An empty scope ends the review: report and stop.

## 1. Cleanup

Spawn a subagent with the scope and: "Read the `no-comments` skill file at its absolute path (`~/.agents/skills/no-comments/SKILL.md` in this setup) and follow it in full. Report the diff and the checks you ran."

Done when the subagent returns a diff and a check result.

`no-comments` is user-invoked, so it cannot be loaded by name. Reading the file is the way in.

The subagent is unattended. `no-comments` pass 4 asks before encoding a constraint. Unattended, it deletes the comment and reports the constraint open. Accept that, or run this phase yourself.

## 2. Reviews

Run both in one block, one call each, with the same scope and the cleanup diff:

- Load `code-review`. Report only.
- Load `ponytail-review`. Report only.

Done when both return a report.

## 3. Merge

- Dedupe by `path:line`.
- Severity: a `code-review` finding inherits its lens. Security and correctness are Must fix. Performance and maintainability are Should fix. Keep the highest severity.
- Drop any suggestion to add a comment. The cleanup owns comments.
- One verdict: any must-fix or failed cleanup check wins.

## Output

1. Cleanup: files, comments removed, fixes, checks.
2. Must fix.
3. Should fix.
4. Nice to have.
5. `Verdict:` and what was not checked.

A failed lens: mark it `not checked`, finish the rest, and call the verdict partial.
