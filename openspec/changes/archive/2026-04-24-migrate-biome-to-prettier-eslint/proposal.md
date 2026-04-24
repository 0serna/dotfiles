## Why

The project currently uses Biome as an all-in-one formatter, linter, and import organizer. To align with broader ecosystem conventions and leverage dedicated tools with larger plugin ecosystems, we will migrate formatting to Prettier and linting to ESLint 9 with flat config.

## What Changes

- **Remove Biome** from devDependencies and delete `biome.json`.
- **Add Prettier** with a `.prettierrc` that preserves the current formatting style (2-space indent, trailing commas `all`).
- **Add ESLint 9** with flat config (`eslint.config.js`), `@eslint/js`, and `typescript-eslint` using `recommended` presets.
- **Add `prettier-plugin-organize-imports`** to replace Biome's `organizeImports` action.
- **Add `eslint-config-prettier`** to disable conflicting ESLint formatting rules.
- **Update npm scripts** (`check`, `lint-staged`) to run Prettier and ESLint instead of Biome.
- **BREAKING**: All source files will be reformatted on the first run, producing a one-time large diff.

## Capabilities

### New Capabilities

- `prettier-formatting`: Project-wide code formatting via Prettier with consistent style and automatic import organization.
- `eslint-linting`: Static analysis and linting via ESLint 9 flat config with TypeScript support.

### Modified Capabilities

None. This is an implementation-level tooling change with no spec-level requirement modifications.

## Impact

- `package.json`: new devDependencies and updated scripts.
- `biome.json`: deleted.
- New files: `.prettierrc`, `eslint.config.js`.
- `.husky/` or `lint-staged` config: updated to invoke Prettier and ESLint.
- All `src/**/*.ts` files: one-time mass reformat.
