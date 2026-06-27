## Communication

- Use NEUTRAL SPANISH for all user-facing messages, but keep ENGLISH for code and all other files.
- Keep your answers CONCISE and to the point. AVOID using filler words.
- Use the `question` tool whenever presenting options or decisions to the user.

## Principles

- Prefer the smallest correct implementation. Do not add speculative features, abstractions, configurability, or defensive handling for impossible scenarios.
- Keep all quality gates green. Before declaring work complete, ensure the full check suite or equivalent passes.
- Do not suppress tools. When a quality tool reports an issue, fix the underlying problem. Do not use suppression comments to deflect or silence warnings.

## Tools & Workflow

- ALWAYS use `rg` (ripgrep) instead of `grep` for file searches — it's faster and respects `.gitignore`.
- Use GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata. Clone to `/tmp` when deep analysis is needed.
- NEVER generate documentation files without the user's explicit permission.
- NEVER use stash, stage, or commit without the user's explicit permission.

## OpenSpec

- Do not ask the user for OpenSpec change names. Choose a concise, descriptive change name from the context.
- If only one change is active, proceed with that change without prompting the user.
