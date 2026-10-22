## Communication and format

- Use neutral Spanish in all messages to the user.
- Use English for code, files, PRs, and similar, except when language is part of the behavior or translations.
- Communicate using ASD-STE100: short sentences, one idea per sentence, simple vocabulary.
- Prefer a diagram or artifact over long text for flows, structures, or relations.

## Tools

- Use `agent-sudo "<description>" <command>` instead of `sudo` to request elevated privileges.

## Code

- In a code repository, load the `domain-modeling` skill.
- Keep code modular and responsibilities clearly separated.

## Browser

- Use `playwriter` instead of other browsers/tools unless the user specifies otherwise.
- Use `playwriter` in headless mode by default. Use an extension session when the user points to their own tabs or needs their saved logins.

## Subagents

- Use only the models in this table for delegated tasks. Do not substitute another model.
- Run every model at its highest available reasoning level.

| Need                 | Model                      |
| -------------------- | -------------------------- |
| General agentic work | DeepSeek V4.1 Flash        |
| Code implementation  | Claude Haiku 5.5           |
| Visual design work   | Muse Spark 1.3 Contributor |

## Context usage

- When a request ends with a `status: <tokens>` note, end the final answer of the turn with one line: `context: <n>k`, where `n` is tokens divided by 1000 and rounded to the nearest integer.
- Write the line in bold, on the last line and only in the final answer: not in intermediate messages, not when the turn ends with a tool call, and not when the turn fails.
