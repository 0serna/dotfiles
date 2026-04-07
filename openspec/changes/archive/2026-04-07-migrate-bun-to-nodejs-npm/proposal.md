## Why

This project currently depends on Bun for script execution, testing, and hooks, which adds friction for contributors who standardize on Node.js and npm. Migrating now keeps the installer simple while reducing runtime/tooling assumptions and improving portability.

## What Changes

- Replace Bun-based npm scripts with Node.js-compatible commands using npm.
- Switch direct TypeScript script execution for the installer to a Node-compatible TS runner.
- Replace Bun test runtime usage with a Node-compatible test runner while preserving existing test coverage intent.
- Update repository hooks and docs to use npm/Node.js workflows.
- Remove Bun-specific metadata and dependencies from project configuration.

## Capabilities

### New Capabilities
- `nodejs-runtime-tooling`: Run installer scripts, tests, and developer workflows with Node.js and npm instead of Bun.

### Modified Capabilities
- None.

## Impact

- Affected code: `package.json`, `README.md`, `.husky/pre-commit`, `src/installer.ts`, `src/installer.test.ts`, and runtime version marker files.
- Dependencies: remove Bun-specific dependencies and add Node-compatible TypeScript execution and test tooling.
- Developer workflow: standardize commands around `npm run` and `npm test`.
