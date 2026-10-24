## Communication and format

- Use neutral Spanish in all messages to the user.
- Use English for code, files, PRs, and similar, except when language is part of the behavior or translations.
- Communicate using ASD-STE100: short sentences, one idea per sentence, simple vocabulary.
- Prefer a mermaid diagram over long text for flows, structures, or relations.

## Tools

- Use `agent-sudo "<description>" <command>` instead of `sudo` to request elevated privileges.

## Code

- In a code repository, load the `domain-modeling` skill.
- Keep code modular and responsibilities clearly separated.

## Browser

- Run `playwriter skill` instead of other browsers unless the user specifies otherwise.
- Use `playwriter` in headless mode by default. Use an extension session when the user points to their own tabs or needs their saved logins.

## Subagents

- Use only the models in this table for delegated tasks. Do not substitute another model.
- Run every model at its highest available reasoning level.

| Need                 | Model                      |
| -------------------- | -------------------------- |
| General agentic work | DeepSeek V4.1 Flash        |
| Code implementation  | DeepSeek V4.1 Flash        |
| Visual design work   | Muse Spark 1.3 Contributor |
