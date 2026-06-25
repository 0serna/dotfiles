---
name: agent-guidelines
description: >-
  AGENTS.md: create or update repository agent guidelines when the user asks for AGENTS.md.
---

# Agent Guidelines

Generate or update the two default sections — **Repository Structure** (directory tree) and **Repository Commands** (command list) — in `AGENTS.md`, preserving all unrelated content exactly. You may suggest additional sections when the repository warrants them; add them only after explicit user approval.

## Workflow

1. Load `templates/agents-md-example.md` to see the exact output format.
2. Read `AGENTS.md` if it exists — identify every unrelated section to preserve exactly.
3. Detect the project ecosystem from manifests, build files, layout, and tooling until the repository's primary languages, package managers, and task runners are accounted for.
4. Map the repository tree and explicit commands until every useful root-level command source and `scripts/` executable has been checked.
5. If notable characteristics are not captured by the default sections (special testing setup, non-obvious constraints, complex architecture), ask whether to add concise extra sections; do not add them without approval.
6. Update or create `AGENTS.md` at root — replace only the two target sections and approved extra sections (see `Update Rules`).
7. Present a summary: whether created or updated, tree depth, commands listed, and any user-approved extra sections.

## Repository Structure

Build a markdown code-fence tree starting at `.`. Include important source/doc directories. Do **not** include: root config/CI files, `.git`, dependency dirs, build outputs (`dist/`, `build/`, `.next/`, `target/`), caches, logs, editor state, or tooling directories (`.husky/`, `.github/`, `.vscode/`, `.agents/`). Keep depth shallow (1–2 levels) unless deeper levels reveal meaningful boundaries (e.g. monorepo `packages/`, nested source/test pairs). Annotate directories only when the purpose is non-obvious or project-specific.

## Repository Commands

List only explicit, useful commands from script manifests, task runners (`package.json`, `Makefile`, `justfile`, `Taskfile.yml`, language-specific task sections), or executable files in `scripts/`. Include install, test, lint, format, typecheck, build, dev, and check commands when explicitly defined. Omit lifecycle hooks, private/internal helper targets, unsafe/deploy-only commands, and anything not useful. Do not invent conventional commands from ecosystem detection alone. If no useful commands are found, keep the section and write `No useful commands detected.`

## Best Practices

Additional sections should only contain information the agent cannot infer from reading the codebase:

- **Include** non-obvious commands with exact flags, project-specific gotchas, architecture constraints that differ from defaults, and explicit boundaries when applicable.
- **Exclude** standard language conventions, content duplicated from the README, and obvious practices ("write clean code").
- **Prefer specificity**: use exact file paths, version numbers, and command flags over vague descriptions.
- **Keep it concise** — aim for ~100 lines. Link to detailed docs instead of embedding them.

## Update Rules

Find `## Repository Structure` and `## Repository Commands` by heading and replace their entire content (from heading to next same/higher level heading or EOF). If a section with a different name exists (e.g. `## Project Structure`), rename it to the standard heading — do not preserve the old name. If a heading is missing entirely, insert it — Repository Structure before all non-generated content, Repository Commands after it. Preserve all other content exactly. If the user approves extra sections, insert or replace only those sections. If no `AGENTS.md` exists, create one with the two default sections plus approved extra sections. Do not format, lint, or validate `AGENTS.md` afterwards.

## Gotchas

- The skill operates on the **current working directory** as the repository root, not `git rev-parse --show-toplevel`.
- If no command source is present, do not ask the user for commands; keep `Repository Commands` with `No useful commands detected.`
- Do not modify unapproved sections — preservation is stricter than improvement.
