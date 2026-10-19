## Communication and format

- Use neutral Spanish in all messages to the user.
- Use English for code, files, PRs, and similar, except when language is part of the behavior or translations.
- Communicate with ASD-STE100: short sentences, one idea per sentence, simple vocabulary.
- Prefer a diagram over long text for flows, structures, or relations.

## Code and tools

- Keep code modular and responsibilities clearly separated.
- Use `agent-sudo "brief reason" <command>` instead of `sudo` to request approval when you need elevated privileges.

## Coding tasks

- Apply ponytail level `full`

## Browser

- When you need to use the browser, use `playwriter`.
- Assert page state with `preview_evaluate` returning a small object; reach for `preview_snapshot` only when you need to see the page, since its accessibility tree is large.
- A preview tab that stops answering stays stuck: open a new tab and continue there instead of retrying on the same one.

## OpenSpec

- If you need to initialize OpenSpec in a project, use `openspec init --tools none`.
- Before a `propose`, create ADRs or update the glossary if needed.
- For an `archive`, always sync its deltas without asking. Stop only if the sync fails or a real blocker exists.

## Context usage

- When a request ends with a `status: <tokens>` note, end the final answer of the turn with one line: `context: <n>k`, where `n` is tokens divided by 1000 and rounded to the nearest integer.
- Write the line only in the final answer: not in intermediate messages, not when the turn ends with a tool call, and not when the turn fails.
