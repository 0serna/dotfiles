---
name: handoff-thread
description: Continue the current work or analysis in a fresh T3 thread.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: false

---

# Handoff thread

Continue the current work or analysis in a fresh T3 thread.

1. **Capture the state.** Follow the `handoff` skill: save to `$TMPDIR` (else `/tmp`), include a "Suggested skills" section, reference existing artifacts by path, and redact secrets. Done when the file is non-empty.
2. **Launch the fresh thread.** Call `t3_thread_launch` with a short `title` that names the work; `workspaceStrategy: { type: "root" }` unless the user names a worktree; and a `message` that says: `Read the handoff at <absolute path> and get in context. Report the current state to the user, then wait for their instruction. Start no work before that.` Done when the call returns a `threadId`.
3. **Report.** Link the thread as `[<title>](t3-thread://v1/<threadId>)` and give the handoff path. If the launch fails, report the error; do not claim a thread exists.
