## Communication

- Keep your answers concise and to the point. Avoid using filler words.
- Use the `question` tool whenever presenting options or decisions to the user.

## Engineering Behavior

- Before coding, state assumptions when they affect the solution. If the request has multiple plausible interpretations, ask instead of choosing silently.
- Prefer the smallest correct implementation. Do not add speculative features, abstractions, configurability, or defensive handling for impossible scenarios.
- Make surgical changes. Touch only files and lines that directly support the user's request, match the existing style, and do not refactor adjacent code unless required.
- Clean up only artifacts introduced by your own changes, such as unused imports or now-dead helpers. Mention unrelated dead code instead of removing it.
- For non-trivial work, define a brief success criterion and verify it with the most relevant available command or test.

## Project Management

- After finishing edits, always run the project's configured check commands when available, such as lint, format, or build.
- NEVER generate documentation files unless the user explicitly requests them.
- NEVER use stash, stage or commit without the user's explicit permission.

## GitHub

- MUST prefer GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata.
- If necessary, clone repositories to temporary directories `/tmp` to analyze them more efficiently.

## OpenSpec

- **Explore** (openspec-explore): Use `advisor` before declaring done or crystallizing findings.
- **Propose** (openspec-propose): Use `advisor` after creating all artifacts to validate completeness and quality.
- **Apply** (openspec-apply-change): Use `advisor` when encountering blockers or issues, and before declaring done to validate all tasks.

## Code Quality

- **Do not suppress Fallow.** When Fallow reports a complexity issue, refactor the code. Do not use `// fallow-ignore` to hide technical debt.
- **Ask when unclear.** If you are unsure how to resolve a Fallow warning, ask the user rather than suppressing it.
