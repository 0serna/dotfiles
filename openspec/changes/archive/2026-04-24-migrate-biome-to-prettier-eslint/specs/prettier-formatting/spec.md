## ADDED Requirements

### Requirement: Prettier formats all supported files

The project SHALL use Prettier to format all source, JSON, and configuration files.

#### Scenario: Run Prettier on the project

- **WHEN** a contributor runs `npx prettier --write .`
- **THEN** all supported files are formatted consistently

### Requirement: Prettier configuration matches existing style

The Prettier configuration SHALL preserve the formatting style previously enforced by Biome.

#### Scenario: Verify formatting parity

- **WHEN** Prettier formats a TypeScript file
- **THEN** indentation is 2 spaces and trailing commas are used everywhere allowed

### Requirement: Imports are organized automatically

Prettier SHALL organize imports using `prettier-plugin-organize-imports`.

#### Scenario: Import organization on format

- **WHEN** a contributor runs Prettier on a TypeScript file with unordered imports
- **THEN** imports are sorted and grouped automatically
