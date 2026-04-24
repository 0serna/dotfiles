## Purpose

Define the ESLint-based linting requirements for the project.

## Requirements

### Requirement: ESLint lints TypeScript and JavaScript files

The project SHALL use ESLint 9 with flat config to lint all TypeScript and JavaScript source files.

#### Scenario: Run ESLint on the project

- **WHEN** a contributor runs `npx eslint .`
- **THEN** ESLint reports any lint violations in source files

### Requirement: ESLint uses recommended presets

ESLint SHALL extend `@eslint/js/recommended` and `typescript-eslint/recommended`.

#### Scenario: Verify recommended rules are active

- **WHEN** ESLint processes a TypeScript file with an unused variable
- **THEN** ESLint reports the unused variable

### Requirement: ESLint does not conflict with Prettier

ESLint SHALL include `eslint-config-prettier` as the final configuration to disable all formatting rules.

#### Scenario: No formatting rule conflicts

- **WHEN** a file contains indentation that Prettier will reformat
- **THEN** ESLint does not report indentation errors

### Requirement: ESLint ignores generated and dependency directories

ESLint SHALL ignore `node_modules`, `dist`, `.git`, and any other non-source directories.

#### Scenario: Linting the project root

- **WHEN** a contributor runs ESLint on the project root
- **THEN** no files inside `node_modules` or `dist` are linted
