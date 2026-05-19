---
name: agents-md-creator
description: >-
  Generate or update the AGENTS.md of a JavaScript or TypeScript
  repository following the https://agents.md/ standard. Use when asked to create,
  generate, update, or refresh AGENTS.md.
---

# AGENTS.md Creator

Generate or update the two default sections — **Repository Structure** (directory tree) and **Repository Commands** (command list) — in `AGENTS.md`, preserving all unrelated content. You may suggest additional sections to the user when the repository warrants them, and you can improve existing content outside the generated sections.

## Workflow

1. Load `templates/agents-md-example.md` to see the exact output format.
2. Read `AGENTS.md` if it exists — identify unrelated content to preserve.
3. Detect **TypeScript** (`tsconfig.json` or `.ts` sources).
4. Map the repository tree and available commands from `package.json`.
5. If the repository has notable characteristics not captured by the default sections (special testing setup, non-obvious constraints, complex architecture), suggest additional sections to the user.
6. Update or create `AGENTS.md` at root — replace only the two target sections (see [Update Rules](#update-rules)). Do not format, lint, or validate the file afterwards.
7. Present a summary: whether created or updated, tree depth, commands listed, and any decisions the user answered.

## Repository Structure

Build a markdown code-fence tree starting at `.`. Include important source/doc directories. Do **not** include: root config files (package.json, tsconfig, formatters, CI), `.git`, dependency dirs, build outputs (`dist/`, `.next/`), caches, logs, editor state, or tooling directories (`.husky/`, `.github/`, `.vscode/`, `.agents/`). Keep depth shallow (1–2 levels) unless deeper levels reveal meaningful boundaries (e.g. monorepo `packages/`, nested source/test pairs). Annotate TypeScript directories when applicable.

## Repository Commands

List commands from `package.json`. Include: install, test, lint, format, typecheck, build, dev, and check (quality gate). Omit lifecycle scripts (`prepare`, `postinstall`), unsafe/deploy-only commands, and anything not useful. If no useful commands are found, write `No useful commands detected.`

## Best Practices

The generated `AGENTS.md` should only contain information the agent cannot infer from reading the codebase:

- **Include** non-obvious commands with exact flags, project-specific gotchas, architecture constraints that differ from defaults, and explicit boundaries when applicable.
- **Exclude** standard language conventions (linters, formatters), content duplicated from the README, and obvious practices ("write clean code").
- **Prefer specificity**: use exact file paths, version numbers, and command flags over vague descriptions.
- **Keep it concise** — aim for ~100 lines. Link to detailed docs instead of embedding them.

## Update Rules

Find `## Repository Structure` and `## Repository Commands` by heading and replace their entire content (from heading to next same/higher level heading or EOF). If a section with a different name exists (e.g. `## Project Structure`), rename it to the standard heading — do not preserve the old name. If a heading is missing entirely, insert it — Repository Structure before all non-generated content, Repository Commands after it. Preserve all other content exactly. If no `AGENTS.md` exists, create one with only the two sections.

## Gotchas

- The skill operates on the **current working directory** as the repository root, not `git rev-parse --show-toplevel`.
- If `package.json` is missing, **ask** the user — do not silently skip or abort.
- Do not format, lint, or validate the generated `AGENTS.md` — that could alter preserved content.
