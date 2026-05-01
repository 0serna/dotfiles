---
description: Configure JS/TS quality tooling
---

## Arguments

No arguments expected.

## Task

Configure or update JavaScript/TypeScript quality tooling in a repository with `package.json`: Prettier, ESLint, Fallow, Husky, lint-staged, and unified `check` and `format` scripts.

## Workflow

1. Confirm the current repository has a `package.json`. If not, print `No package.json found` and stop.
2. Detect the package manager from lockfiles, preferring `pnpm-lock.yaml`, then `yarn.lock`, then `bun.lock` or `bun.lockb`, then `package-lock.json`; default to `npm` if no lockfile exists.
3. Read existing quality-tool configuration before editing:
   - `package.json`
   - `eslint.config.*` and `.eslintrc*`
   - `.prettierrc*`, `prettier.config.*`, and any `prettier` field in `package.json`
   - `.husky/pre-commit`
   - `lint-staged` config files and any `lint-staged` field in `package.json`
   - `.gitignore`
4. Detect whether the repo uses TypeScript from `tsconfig.json`, TypeScript source files, or TypeScript dependencies.
5. Detect whether the repo uses OpenSpec from an `openspec/` directory.
6. Install missing dev dependencies with the detected package manager:
   - Always ensure `prettier`, `eslint`, `@eslint/js`, `eslint-config-prettier`, `fallow`, `husky`, and `lint-staged` are present.
   - If the repo uses TypeScript, also ensure `typescript-eslint` is present.
7. Configure ESLint with flat config:
   - If no ESLint config exists, create `eslint.config.js` using `@eslint/js` recommended config, `typescript-eslint` recommended config when TypeScript is used, and `eslint-config-prettier` last.
   - If a flat config already exists, minimally update it only when the intended recommended configs are clearly absent.
   - If only legacy ESLint config exists or the existing config is complex, stop and ask the user before replacing or migrating it.
8. Configure Prettier defaults:
   - If no Prettier config exists, create a minimal config using Prettier defaults.
   - If Prettier config exists, leave it unchanged unless it prevents the requested integration.
9. Configure Fallow integration:
   - Ensure `.gitignore` ignores `.fallow/` for Fallow's local cache and generated state.
10. Update `package.json` scripts:
    - Ensure `check` includes `prettier --check .`, `eslint .`, and `fallow --fail-on-issues`, preserving existing test, typecheck, build, or other verification steps unless the user approves removing them.
    - If the repo has an `openspec/` directory, ensure `check` includes `openspec validate --all --json`.
    - Ensure `format` runs `prettier --write .`, preserving any existing required behavior if possible.
    - Ensure `prepare` runs `husky`, preserving any existing required behavior if possible.
11. Configure lint-staged:
    - Ensure all recognized files run `prettier --write --ignore-unknown`.
    - Ensure JavaScript and TypeScript files run `eslint --fix`.
12. Configure Husky pre-commit:
    - Ensure `.husky/pre-commit` runs the `check` script followed by lint-staged, both with the detected package manager's executable runner (e.g. `npm run check && npx lint-staged`).
    - Do not run `fallow` directly in pre-commit; Fallow belongs in `check`.
13. Run the package manager install command if dependencies or lockfiles need updating.
14. Run the repository's check command with the detected package manager.

## Rules

- Only operate on repositories with `package.json`.
- Keep changes minimal and specific to quality tooling.
- Do not overwrite existing ESLint, Prettier, Husky, or lint-staged configuration without reading it first.
- Preserve existing config choices unless they conflict with the requested tooling setup.
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

## Output

Return a concise summary with:

- package manager detected
- dependencies added or already present
- configuration files created or updated
- final `check` script
- final `format` script
- pre-commit behavior (runs `check` then lint-staged)
- verification command and result
- any skipped changes, questions, or remaining risks
