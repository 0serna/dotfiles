---
description: Setup repository agent context
---

## Arguments

No arguments expected.

## Task

Create or update the repository root `AGENTS.md` with concise context that helps future agents navigate the project and run the most useful configured commands.

Maintain only these generated sections:

- `## Project Structure`
- `## Repository Commands`

## Workflow

1. Confirm the current working directory is inside a git repository. If not, print `No git repository found` and stop.
2. Resolve the repository root with `git rev-parse --show-toplevel`.
3. Target `AGENTS.md` at the repository root.
4. Inspect the repository structure just enough to identify the important source, test, app, package, module, documentation, script, and workflow directories.
5. Build a concise `Project Structure` section as a directory tree:
   - Start at `.`.
   - Include important directories and only the rare file that is a true code or workflow entry point.
   - Do not include root-level package manifests, lockfiles, or routine configuration files.
   - Choose the depth based on the repository: stay shallow by default, but draw deeper levels when they reveal meaningful boundaries an agent should know before searching.
   - Use this format:

````markdown
## Project Structure

```text
.
├── src/                  # source code
├── tests/                # test suite
├── scripts/              # local automation
└── docs/                 # project documentation
```
````

- Adapt labels and descriptions to the actual repository.
- Omit directories from the template that are not present or not important.

6. Inspect configured command sources, when present:
   - `package.json`
   - `Makefile`
   - `justfile`
   - `Taskfile.yml` or `Taskfile.yaml`
   - `pyproject.toml`
   - `Cargo.toml`
   - `go.mod`
   - scripts under `bin/`, `script/`, `scripts/`, or similar directories
7. Build a concise `Repository Commands` section listing only useful commands an agent should know about, using this format:

```markdown
## Repository Commands

- `npm install`: install dependencies.
- `npm test`: run tests.
- `npm run check`: run all configured checks.
- `npm run format`: format files.
```

- Adapt commands and descriptions to the actual repository.
- Omit commands from the template that are not configured or not useful.
- If no useful commands are detected, write `No useful repository commands detected.` under the section heading.

8. Read the existing `AGENTS.md` if it exists.
9. Create or replace only the generated `Project Structure` and `Repository Commands` sections:
   - If a section exists, replace that full section.
   - If a section does not exist, append it to the end of the file.
   - Preserve all unrelated content unchanged.
10. If `AGENTS.md` does not exist, create it with only the generated sections.
11. Run the repository's configured formatting or validation command when one is clearly available and relevant to Markdown or repository checks.

## Rules

- Do not accept or require arguments.
- Always target `AGENTS.md` at the repository root.
- Do not stage, stash, commit, or push changes.
- Do not run destructive git commands.
- Keep generated content concise and practical for agent navigation.
- Do not dump the full repository tree.
- Do not include common root-level files in `Project Structure` just because they exist, including `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, lockfiles, formatter config, lint config, TypeScript config, or CI config.
- Omit irrelevant files and directories, including `.git`, dependency directories, build outputs, caches, generated artifacts, logs, temporary files, editor state, and lockfiles unless a lockfile is the only useful package-manager signal.
- Prefer important source, test, app, package, module, script, documentation, and workflow directories over exhaustive coverage.
- Include files in `Project Structure` only when they are uncommon but important entry points, such as a primary executable script or a central workflow definition that is not obvious from root-level config discovery.
- Omit commands that are internal, duplicated, obsolete, overly specific, dangerous, deploy-only, credential-dependent, or not useful for routine agent work.
- Prefer commands for install, development, test, lint, format, typecheck, build, validation, and local tooling.
- If a command appears destructive or environment-specific, exclude it unless the repository clearly documents it as safe and essential.
- Do not invent commands. Only list commands backed by repository files.
- Keep command descriptions short and factual.
- Preserve unrelated `AGENTS.md` content exactly unless a minimal whitespace adjustment is needed around the generated sections.

## Output

Return a concise summary with:

- `AGENTS.md` path updated or created
- sections created or replaced
- command sources inspected
- verification command and result, or why verification was skipped
- any assumptions, skipped items, or non-blocking uncertainties
