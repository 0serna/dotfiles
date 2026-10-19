## Communication and format

- Use neutral Spanish in all messages to the user.
- Use English for code, files, PRs, and similar, except when language is part of the behavior or translations.
- Communicate using ASD-STE100: short sentences, one idea per sentence, simple vocabulary.
- Prefer a diagram over long text for flows, structures, or relations.

## Code and tools

- Keep code modular and responsibilities clearly separated.
- Use `agent-sudo "brief reason" <command>` instead of `sudo` to request approval when you need elevated privileges.

## Browser

- Use `playwriter` in headless mode by default. Use an extension session when the user points to their own tabs or needs their saved logins.
- Use `playwriter` instead of other browsers/tools unless the user specifies otherwise.

## OpenSpec

- If you need to initialize OpenSpec in a project, use `openspec init --tools none`.
- Before a `propose`, create ADRs or update the glossary if needed.
- For an `archive`, always sync its deltas without asking. Stop only if the sync fails or a real blocker exists.

## Subagents

- Use only the models in this table for delegated tasks. Do not substitute another model.

| Need | Model | Reasoning |
|---|---|---|
| Reasoning and hard tasks | MiMo-V2.6-Pro | high or unset |
| Long-horizon agentic coding | Muse Spark 1.3 Contributor | xhigh |
| Speed and long context | DeepSeek V4.1 Flash | max |
| Verify its own visual output | GLM-5.3-Flash | max |
| Computer use and security | MiniMax M3.1 Flash | max |
| Summarization and structured extraction | GPT-6 Luna | max |

## Context usage

- When a request ends with a `status: <tokens>` note, end the final answer of the turn with one line: `context: <n>k`, where `n` is tokens divided by 1000 and rounded to the nearest integer.
- Write the line in bold, on the last line and only in the final answer: not in intermediate messages, not when the turn ends with a tool call, and not when the turn fails.
