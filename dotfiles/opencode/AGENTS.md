## Communication

- All communication addressed to the user MUST be in SPANISH.
- Everything else (file content, code, comments, commit messages, documentation) MUST be in ENGLISH.
- Keep your answers brief unless more detail is needed to avoid ambiguity or support a decision.

## OpenSpec Workflow

- After `/opsx:archive` completes, run `openspec validate --all --json` and do not consider the workflow complete until it passes.

## GitHub Research

- MUST prefer GitHub CLI when investigating GitHub repositories, pull requests, issues, and related metadata.

## Background Processes

- Use `nohup` for long-running commands so you can keep working, inspect logs later, and terminate the process by PID if needed.

## Context7

- Use `ctx7` for up-to-date docs when the user asks about libraries, frameworks, SDKs, APIs, CLIs, or cloud services.
- Do not use it for refactoring, new scripts, business logic, code review, or general concepts.
- Workflow: `library` first, then `docs`, then answer from the fetched docs.
- Use the official package name, prefer exact matches, and keep queries specific.
- Do not run more than 3 commands per question.
- For versioned docs, use the `/org/project/version` ID returned by `library`.
