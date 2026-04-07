## 1. Runtime and dependency migration

- [x] 1.1 Replace Bun-based scripts in `package.json` with npm/Node-compatible commands.
- [x] 1.2 Remove Bun-specific dependencies and engine/version declarations, then add `tsx` and `vitest`.
- [x] 1.3 Remove Bun runtime marker files no longer needed for Node.js workflow.

## 2. Test and entrypoint compatibility

- [x] 2.1 Migrate test imports and framework usage from `bun:test` to Vitest APIs.
- [x] 2.2 Update installer entrypoint detection to a Node-compatible mechanism.
- [x] 2.3 Verify installer behavior remains unchanged when executed through npm.

## 3. Workflow and documentation updates

- [x] 3.1 Update `.husky/pre-commit` to run `lint-staged` with npm-compatible execution.
- [x] 3.2 Update `README.md` command examples from Bun to npm equivalents.
- [x] 3.3 Search repository for remaining Bun references and remove or replace them.

## 4. Validation

- [x] 4.1 Run `npm install` to refresh lockfile and dependency graph.
- [x] 4.2 Run `npm run typecheck`, `npm run check`, and `npm test` successfully.
- [x] 4.3 Run `npm run setup` in a safe test context to confirm installer execution path.
