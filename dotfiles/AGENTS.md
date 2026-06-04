## Communication

- Use Spanish for all user-facing messages, but keep English for code and all other files.
- Keep your answers concise and to the point. Avoid using filler words.
- Use the `question` tool whenever presenting options or decisions to the user.

## Engineering

- Before coding, state assumptions when they affect the solution. If the request has multiple plausible interpretations, ask instead of choosing silently.
- Prefer the smallest correct implementation. Do not add speculative features, abstractions, configurability, or defensive handling for impossible scenarios.
- Make surgical changes. Touch only files and lines that directly support the user's request, match the existing style, and do not refactor adjacent code unless required.
- Always use `rg` (ripgrep) instead of `grep` for file searches — it's faster, respects `.gitignore`, and supports modern regex by default.

## Workflow

- Clean up only artifacts introduced by your own changes, such as unused imports or now-dead helpers. Mention unrelated dead code instead of removing it.
- For non-trivial work, define a brief success criterion and verify it with the most relevant available command or test.
- After finishing edits, always run the project's configured check commands when available, such as lint, format, or build.
- NEVER generate documentation files unless the user explicitly requests them.
- NEVER use stash, stage, or commit without the user's explicit permission.

## OpenSpec

- Do not ask the user for OpenSpec change names. Choose a concise, descriptive change name from the context.
- If only one change is active, proceed with that change without prompting the user.

## GitHub

- Use GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata.
- If necessary, clone repositories to temporary directories `/tmp` to analyze them more efficiently.

## Code Quality

- Keep all quality gates green. Before declaring work complete, ensure the full check suite or equivalent passes.
- Do not suppress tools. When a quality tool reports an issue, fix the underlying problem. Do not use suppression comments to deflect or silence warnings.
