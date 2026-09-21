---
name: commit-and-push
disable-model-invocation: true
description: Commit and push all pending changes in the current local workspace.
metadata:
  opencode/autoinvoke: false

---

# Commit and push

1. Inspect `git status --short` and the diff.
2. Stage everything with `git add -A`.
3. Analyze the staged diff and create a concise Conventional Commit message (`type(scope): description`) that accurately describes all pending changes.
4. Push the current branch to its upstream, setting it on `origin` when missing.
5. Confirm the commit, push, and final status.

Stop on conflicts, hook failures, authentication errors, or push failures. Never amend, reset, discard changes, or force-push.
