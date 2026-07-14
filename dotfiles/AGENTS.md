## Additional Instructions

### Communication

- Use neutral Spanish for user-facing messages.
- Use English for code and files, except when language is part of the behavior, such as translations, fixtures, or localized data.
- Route **all** user-owned decisions through the `question` tool — never phrase questions in prose when the tool applies. This includes grilling, clarifications, confirmations, and option selection.

### Tool Equivalences

Some externally-managed skills reference tools by names from other platforms. Use this mapping:

- `AskUserQuestion` → `question` (prompt the user for input or a decision)
- `TodoWrite`, `TodoRead` → not available; track progress in-message
- `Task` / `Agent` (subagent) → not available; execute inline

### Workflow

- Run every quality gate affected by the change before declaring work complete. If a failure is pre-existing and unrelated, ask the user.
- Fix the root cause of every quality-tool finding. If no valid fix is viable, consult the user rather than adding a suppression.
- Use the `/tdd` skill when an automated test can meaningfully fail on the changed behavior and prevent a real regression.
- Prefer GitHub CLI for GitHub investigations. Clone into `/tmp` when inspecting code that is not available locally.
- Obtain explicit user permission before creating documentation files.

### OpenSpec

- Derive a concise, descriptive change name from context when the user does not provide one.
- Before creating proposal, analyze whether the change is large enough to warrant creating two changes. Only do so if it is genuinely necessary.
- After archiving a change, run `openspec validate --all`. Fix failures caused by the work; consult the user about unrelated failures.
