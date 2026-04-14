## Communication

- All communication addressed to the user MUST be in SPANISH.
- Everything else (file content, code, comments, commit messages, documentation) MUST be in ENGLISH.
- Keep your answers brief unless more detail is needed to avoid ambiguity or support a decision.
- Use the `question` tool whenever presenting options or decisions to the user.

## OpenSpec Workflow

- After `/opsx:archive` completes, run `openspec validate --all --json` and do not consider the workflow complete until it passes.

## GitHub Research

- MUST prefer GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata.
- If necessary, clone repositories to temporary directories in /tmp to analyze them more efficiently.

## Background Processes

- Use `tmux` for long-running or background commands.

## Context7

- Use `find-docs` skill for up-to-date docs when the user asks about libraries, frameworks, SDKs, APIs, CLIs, or cloud services.
