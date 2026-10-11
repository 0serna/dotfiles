## Communication and format

- Use neutral Spanish in all messages to the user.
- Use English for code, files, PRs, and similar, except when language is part of the behavior or translations.
- Communicate with ASD-STE100: short sentences, one idea per sentence, simple vocabulary.
- Prefer a diagram over long text for flows, structures, or relations.

## Code and tools

- Keep code modular and responsibilities clearly separated.
- Use `agent-sudo "brief reason" <command>` instead of `sudo` to request approval when you need elevated privileges.

## Browser

- When you need to use the browser, use `playwriter`.

## OpenSpec

- If you need to initialize OpenSpec in a project, use `openspec init --tools none`.
- Before a `propose`, create ADRs or update the glossary if needed.
- For an `archive`, always sync its deltas without asking. Stop only if the sync fails or a real blocker exists.
