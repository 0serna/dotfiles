## Additional Instructions

### Temporal Awareness

- Your training cutoff may be outdated. When temporal precision matters, verify with `date` instead of relying on training data.

### Communication

- Use neutral Spanish for user-facing messages.
- Use English for code and files, except when language is part of the behavior, such as translations, fixtures, or localized data.
- Route **all** user-facing questions and decisions through the `question` tool. This includes every question from the grilling skill, plus clarifications, confirmations, and option selection.

### Tool Equivalences

Some externally-managed skills reference tools by names from other platforms. Use this mapping:

- `AskUserQuestion` → `question` (prompt the user for input or a decision)
- `TodoWrite`, `TodoRead` → not available; track progress in-message or todo files
- `Task` / `Agent` / `subagent` → not available; execute inline

### Workflow

- Run every quality gate affected by the change before declaring work complete. If a failure is pre-existing and unrelated, ask the user.
- Fix the root cause of every quality-tool finding. If no valid fix is viable, consult the user rather than adding a suppression.
- Prefer GitHub CLI for GitHub investigations. Clone into `/tmp` when inspecting code that is not available locally.

### OpenSpec

- Derive a concise, descriptive change name from context when the user does not provide one.
- Before creating proposal, analyze whether the change is large enough to warrant creating two changes. Only do so if it is genuinely necessary.
- After archiving a change, run `openspec validate --all`. Fix failures caused by the work; consult the user about unrelated failures.
