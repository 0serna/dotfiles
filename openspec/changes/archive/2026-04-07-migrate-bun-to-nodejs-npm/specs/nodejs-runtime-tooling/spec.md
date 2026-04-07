## ADDED Requirements

### Requirement: npm-based developer commands
The project SHALL provide installer and verification workflows through npm commands without requiring Bun.

#### Scenario: Run installer with npm
- **WHEN** a contributor runs `npm run setup`
- **THEN** the installer script executes successfully under Node.js

#### Scenario: Run quality checks with npm
- **WHEN** a contributor runs `npm run typecheck` and `npm run check`
- **THEN** both commands run without requiring Bun tooling

### Requirement: Node-compatible TypeScript script execution
The installer entrypoint MUST execute TypeScript directly on Node.js without a prebuild step.

#### Scenario: Direct TypeScript execution
- **WHEN** `npm run setup` is executed on a supported Node.js version
- **THEN** `src/installer.ts` runs directly via a Node-compatible TS runner

### Requirement: Node-compatible test execution
The test suite SHALL run via npm on Node.js and preserve current installation behavior coverage.

#### Scenario: Execute tests with npm
- **WHEN** a contributor runs `npm test`
- **THEN** tests execute using a Node-compatible test framework and complete successfully

### Requirement: Bun-free repository workflow
Repository automation and documentation MUST not require Bun commands.

#### Scenario: Pre-commit hook execution
- **WHEN** the pre-commit hook runs
- **THEN** staged-file checks execute with npm-compatible tooling rather than `bunx`

#### Scenario: Command documentation
- **WHEN** a contributor follows documented setup/test commands
- **THEN** all documented commands use npm/Node.js equivalents
