---
description: Setup JS/TS repository for agent work
---

## Arguments

No arguments expected.

## Task

Prepare a JavaScript/TypeScript repository for effective agent work by configuring or updating quality tooling, then creating or updating the repository root `AGENTS.md` with concise context that helps future agents navigate the project and run the most useful configured commands.

## Workflow

1. Confirm the current repository has a `package.json`. If not, print `No package.json found` and stop.
2. Confirm the current working directory is inside a git repository. If not, print `No git repository found` and stop.
3. Resolve the repository root with `git rev-parse --show-toplevel`.
4. Detect the package manager from lockfiles, preferring `pnpm-lock.yaml`, then `yarn.lock`, then `bun.lock` or `bun.lockb`, then `package-lock.json`; default to `npm` if no lockfile exists.
5. Read existing quality-tool configuration before editing:
   - `package.json`
   - `eslint.config.*` and `.eslintrc*`
   - `.prettierrc*`, `prettier.config.*`, and any `prettier` field in `package.json`
   - `.husky/pre-commit`
   - `lint-staged` config files and any `lint-staged` field in `package.json`
   - `.gitignore`
6. Detect whether the repo uses TypeScript from `tsconfig.json`, TypeScript source files, or TypeScript dependencies.
7. Detect whether the repo uses OpenSpec from an `openspec/` directory.
8. Configure ESLint with flat config, adapting to the repository:
   - If a clear ESLint config already exists, preserve its style and dependencies; minimally update it only when the intended checks are clearly absent.
   - If no ESLint config exists, create the smallest flat config that matches the repository's source types.
   - For JavaScript repositories, use `@eslint/js` recommended config.
   - For TypeScript repositories, use `typescript-eslint` recommended config; add `@eslint/js` only when the repo also has JavaScript files or the chosen TypeScript config explicitly depends on it.
   - Add `eslint-config-prettier` last only when needed to prevent ESLint and Prettier rule conflicts.
   - If only legacy ESLint config exists or the existing config is complex, stop and ask the user before replacing or migrating it. Do not update `AGENTS.md` until this decision is resolved.
9. Install only the dev dependencies required by the chosen configuration:
   - Always ensure the workflow tools `prettier`, `eslint`, `fallow`, `husky`, and `lint-staged` are present.
   - Ensure ESLint helper packages, such as `@eslint/js`, `typescript-eslint`, and `eslint-config-prettier`, only when the existing or intended ESLint config uses them.
10. Configure Prettier defaults:
    - If no Prettier config exists and Prettier defaults are sufficient, do not create a Prettier config file.
    - If no Prettier config exists and explicit repository-specific Prettier options are needed, create the smallest valid config with those options.
    - Never create an empty `.prettierrc`, `prettier.config.*`, or `prettier` field in `package.json`.
    - If Prettier config exists, leave it unchanged unless it prevents the requested integration.
11. Configure Fallow integration:
    - Ensure `.gitignore` ignores `.fallow/` for Fallow's local cache and generated state.
12. Update `package.json` scripts:
    - Ensure `check` includes `prettier --check .`, `eslint .`, and `fallow --fail-on-issues`, preserving existing test, typecheck, build, or other verification steps unless the user approves removing them.
    - If the repo has an `openspec/` directory, ensure `check` includes `openspec validate --all --json`.
    - Ensure `format` runs `prettier --write .`, preserving any existing required behavior if possible.
    - Ensure `prepare` runs `husky`, preserving any existing required behavior if possible.
13. Configure lint-staged:
    - Ensure all recognized files run `prettier --write --ignore-unknown`.
    - Ensure JavaScript and TypeScript files run `eslint --fix`.
14. Configure Husky pre-commit:
    - Ensure `.husky/pre-commit` runs the `check` script followed by lint-staged, both with the detected package manager's executable runner (e.g. `npm run check && npx lint-staged`).
    - Do not run `fallow` directly in pre-commit; Fallow belongs in `check`.
15. Run the package manager install command if dependencies or lockfiles need updating.
16. Run the repository's check command with the detected package manager.
17. Target `AGENTS.md` at the repository root.
18. Inspect the final repository structure just enough to identify the important source, test, app, package, module, documentation, script, and workflow directories.
19. Build a concise `Project Structure` section as a directory tree:
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

20. Inspect final configured JavaScript/TypeScript command sources, when present:
    - `package.json`
    - `Makefile`
    - `justfile`
    - `Taskfile.yml` or `Taskfile.yaml`
    - scripts under `bin/`, `script/`, `scripts/`, or similar directories
21. Build a concise `Repository Commands` section listing only useful commands an agent should know about, using this format:

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

22. Read the existing `AGENTS.md` if it exists.
23. Create or replace only the generated `Project Structure` and `Repository Commands` sections as the first sections in `AGENTS.md`:
    - If a section exists, replace that full section.
    - If a section does not exist, insert it before all unrelated content.
    - Ensure `Project Structure` appears before `Repository Commands`.
    - Preserve all unrelated content unchanged.
24. If `AGENTS.md` does not exist, create it with only the generated sections.
25. Run the repository's configured formatting or validation command when one is clearly available and relevant to Markdown or repository checks.

## Rules

- Do not accept or require arguments.
- Only operate on repositories with `package.json`.
- Always target `AGENTS.md` at the repository root.
- Complete quality-tool configuration and verification before updating `AGENTS.md`.
- Stop before updating `AGENTS.md` if quality-tool configuration requires a user decision.
- Keep changes minimal and specific to quality tooling and generated `AGENTS.md` sections.
- Do not overwrite existing ESLint, Prettier, Husky, or lint-staged configuration without reading it first.
- Preserve existing config choices unless they conflict with the requested tooling setup.
- Do not create empty configuration files or empty config fields; omit config instead when tool defaults are intended.
- Do not remove existing `check` or `format` script behavior unless the user explicitly approves it.
- Stop and ask before migrating legacy ESLint config or replacing complex existing configuration.
- Do not configure CI unless the user explicitly asks.
- Do not add `openspec validate --all --json` unless the repository has an `openspec/` directory.
- Do not stage, stash, commit, or push changes.
- Do not run destructive git commands.
- Do not run Fallow as an autofix step in pre-commit.
- Prefer package-manager-native commands:
  - npm: `npm install --save-dev ...`, `npx lint-staged`, `npm run check`
  - pnpm: `pnpm add -D ...`, `pnpm exec lint-staged`, `pnpm check`
  - yarn: `yarn add --dev ...`, `yarn lint-staged`, `yarn check`
  - bun: `bun add --dev ...`, `bunx lint-staged`, `bun run check`
- Keep generated `AGENTS.md` content concise and practical for agent navigation.
- Do not dump the full repository tree.
- Do not include common root-level files in `Project Structure` just because they exist, including `package.json`, lockfiles, formatter config, lint config, TypeScript config, or CI config.
- Omit irrelevant files and directories, including `.git`, dependency directories, build outputs, caches, generated artifacts, logs, temporary files, editor state, and lockfiles unless a lockfile is the only useful package-manager signal.
- Prefer important source, test, app, package, module, script, documentation, and workflow directories over exhaustive coverage.
- Include files in `Project Structure` only when they are uncommon but important entry points, such as a primary executable script or a central workflow definition that is not obvious from root-level config discovery.
- Omit commands that are internal, duplicated, obsolete, overly specific, dangerous, deploy-only, credential-dependent, or not useful for routine agent work.
- Prefer commands for install, development, test, lint, format, typecheck, build, validation, and local tooling.
- If a command appears destructive or environment-specific, exclude it unless the repository clearly documents it as safe and essential.
- Do not invent commands. Only list commands backed by repository files.
- Keep command descriptions short and factual.
- Preserve unrelated `AGENTS.md` content exactly unless a minimal whitespace adjustment is needed around the generated sections.
- Keep the generated `Project Structure` and `Repository Commands` sections at the top of `AGENTS.md`, before any unrelated sections.

## Output

Return a concise summary with:

- package manager detected
- dependencies added or already present
- configuration files created or updated
- final `check` script
- final `format` script
- pre-commit behavior (runs `check` then lint-staged)
- `AGENTS.md` path updated or created
- `AGENTS.md` sections created or replaced
- command sources inspected for `AGENTS.md`
- verification commands and results, or why verification was skipped
- any skipped changes, questions, assumptions, non-blocking uncertainties, or remaining risks
