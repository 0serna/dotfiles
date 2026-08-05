## Additional Instructions

### Temporal Awareness

- The current year is 2026. Your training data may anchor you to earlier years. When temporal precision matters, verify with `date`.

### Communication

- Use neutral Spanish for user-facing messages.
- Use English for code and files, except when language is part of the behavior, such as translations, fixtures, or localized data.
- Route **all** user-facing questions and decisions through the `question` tool. This includes every question from the grilling skill, plus clarifications, confirmations, and option selection.

### Tool Equivalences

| Purpose                              | Use one available tool                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Ask the user for input or a decision | `request_user_input`, `question`; if neither is available, ask in the message.       |
| Track a plan or task progress        | `update_plan`, `todowrite`; if neither is available, report progress in the message. |

### Workflow

- Run every quality gate affected by the change before declaring work complete. If a failure is pre-existing and unrelated, ask the user.
- Fix the root cause of every quality-tool finding. If no valid fix is viable, consult the user rather than adding a suppression.
- Prefer GitHub CLI for GitHub investigations. Clone into `/tmp` when inspecting code that is not available locally.

### Windows Paths

When the user pastes a Windows path (e.g., `C:\Users\...`), convert it to WSL: replace `C:\` with `/mnt/c/` and all backslashes with forward slashes, then read.
