## Communication

- Use neutral Spanish for user-facing messages. Be concise without omitting necessary information.
- Use English for code and files, except when language is part of the behavior, such as translations, fixtures, or localized data.
- Route user-owned decisions about scope, requirements, or tradeoffs through the `question` tool or the platform's interactive equivalent. During grilling, ask exactly one question at a time through it.

## Principles

- Run every quality gate affected by the change before declaring work complete. When impact is unclear, run the reasonably broadest applicable set. If a failure is pre-existing and unrelated, ask the user how to proceed.
- Fix the root cause of every quality-tool finding. If no valid fix is viable, consult the user rather than adding a suppression.

## Tools &amp; Workflow

- Use the `/tdd` skill when an automated test can meaningfully fail on the changed behavior and prevent a real regression.
- Prefer GitHub CLI for GitHub investigations; use an available alternative when it is unavailable. Clone into `/tmp` when inspecting code that is not available locally.
- Obtain explicit user permission before creating documentation files.

## OpenSpec

- Derive a concise, descriptive change name from context when the user does not provide one.
- After archiving a change, run `openspec validate --all`. Fix failures caused by the work; consult the user about unrelated failures.
