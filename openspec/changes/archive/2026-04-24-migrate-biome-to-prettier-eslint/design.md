## Context

The repository currently uses Biome 2.3.13 as a unified formatter, linter, and import organizer. The configuration in `biome.json` specifies 2-space indentation, trailing commas `all`, and `organizeImports: on`. The `check` script runs `biome check --write .`, and `lint-staged` invokes Biome for staged `.{ts,js,json,jsonc}` files.

We are migrating to dedicated tools: Prettier for formatting and ESLint 9 (flat config) for linting, with `prettier-plugin-organize-imports` replacing Biome's import organization.

## Goals / Non-Goals

**Goals:**

- Replace Biome with Prettier + ESLint while preserving the current code style.
- Maintain `organizeImports` behavior via `prettier-plugin-organize-imports`.
- Keep `npm run check` and `lint-staged` working with zero friction for contributors.
- Use `recommended` presets for ESLint (`@eslint/js/recommended`, `typescript-eslint/recommended`).

**Non-Goals:**

- Introducing type-aware linting (`strictTypeChecked`) — out of scope.
- Adding `eslint-plugin-import` for module resolution linting — out of scope unless requested later.
- Changing `tsconfig.json` compiler options.

## Decisions

1. **Prettier for formatting**
   - Rationale: Industry standard, largest ecosystem, consistent output across editors.
   - Style parity: `.prettierrc` mirrors Biome settings (`trailingComma: "all"`, `tabWidth: 2`, `semi: true`).

2. **ESLint 9 flat config**
   - Rationale: Modern ESLint standard, eliminates `.eslintrc` files, native TypeScript support via `typescript-eslint`.
   - Config: `eslint.config.js` imports `@eslint/js`, `typescript-eslint`, and `eslint-config-prettier/flat` (always last).

3. **`prettier-plugin-organize-imports` for import ordering**
   - Rationale: Uses the TypeScript language service (same engine as VS Code), zero configuration, single command (`prettier --write`).
   - Alternative considered: `eslint-plugin-import` + `simple-import-sort` — more powerful but requires resolver setup and adds complexity. Rejected in favor of the simpler, well-maintained Prettier plugin.

4. **No `eslint-plugin-import`**
   - Rationale: Biome's `recommended` rules did not include import resolution checks. Adding `eslint-plugin-import` would introduce new lint errors unrelated to the migration. Deferred to a future change.

5. **`eslint-config-prettier/flat` placed last in config array**
   - Rationale: Ensures all formatting rules from ESLint and plugins are disabled, letting Prettier own formatting exclusively.

## Risks / Trade-offs

| Risk                                                                                                   | Mitigation                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Prettier and Biome format some constructs differently (e.g., ternary wrapping, long type annotations). | Accept a one-time mass-reformat commit. Review the diff before committing.                                                       |
| Loss of Biome-specific lint rules (e.g., `noSecrets`, `noNodejsModules`).                              | Audit current Biome output; if any critical rules are missed, evaluate ESLint plugins. `recommended` presets cover the majority. |
| `prettier-plugin-organize-imports` requires TypeScript to be installed.                                | Already a devDependency; no extra cost.                                                                                          |
| Performance: ESLint + Prettier is slower than Biome (Rust).                                            | Repository is small (< 10 source files); impact is negligible.                                                                   |

## Migration Plan

1. Uninstall `@biomejs/biome`.
2. Install new devDependencies: `prettier`, `prettier-plugin-organize-imports`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`.
3. Delete `biome.json`.
4. Create `.prettierrc` and `eslint.config.js`.
5. Update `package.json` scripts (`check`) and `lint-staged`.
6. Run `prettier --write .` to reformat all files.
7. Run `eslint --fix .` to auto-fix any lint issues.
8. Commit the tooling changes + reformat in one or two commits.

## Open Questions

- None at this time.
