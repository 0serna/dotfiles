## Context

The repository is a TypeScript-based configuration installer with a small code surface area. Today, Bun is used for script execution (`bun run`), tests (`bun:test`), and git hooks (`bunx`). The runtime migration must be minimal and fast, keep direct TypeScript execution for the installer, and standardize workflows around npm.

Key constraints:
- Keep implementation lightweight with no build pipeline for script execution.
- Preserve current installer behavior and test intent.
- Minimize churn in code and contributor workflows.

## Goals / Non-Goals

**Goals:**
- Run installer commands with `npm` on Node.js.
- Keep direct TypeScript execution for `src/installer.ts`.
- Replace Bun-coupled test/runtime entry points with Node-compatible tooling.
- Update docs and hooks to match the new npm-first workflow.

**Non-Goals:**
- Refactoring installer business logic.
- Introducing a compile-to-dist deployment flow.
- Reworking repository architecture or OpenSpec process conventions.

## Decisions

1. Use `tsx` for direct TypeScript script execution on Node.js.
   - Rationale: `tsx` provides the closest Bun-like ergonomics for one-off TS script execution without introducing build steps.
   - Alternatives considered:
     - `ts-node`: workable, but generally slower and requires more execution flags/configuration for ESM parity.
     - `tsc && node dist/...`: robust but violates the minimal/fast and direct-execution goals.

2. Use `vitest` as the Bun test replacement.
   - Rationale: existing test style (`describe/it/expect`) maps with minimal rewrite cost.
   - Alternatives considered:
     - `node:test`: fewer dependencies but requires broader assertion and API rewrites.

3. Standardize all developer entry points on npm.
   - Rationale: aligns with requested workflow and avoids Bun-specific commands in scripts, hooks, and docs.
   - Alternatives considered:
     - Keep mixed tooling (`bun` + `npm`): lower immediate edits but preserves fragmentation.

4. Replace Bun-specific runtime markers/dependencies.
   - Rationale: avoid ambiguous runtime contracts and reduce lock-in.
   - Scope includes removing Bun engine/type references and Bun version marker files.

5. Make CLI entrypoint detection Node-compatible.
   - Rationale: current `import.meta.main` is Bun-specific and must be replaced to keep CLI behavior when run under Node.js.
   - Alternatives considered:
     - Keep current behavior and execute only through wrappers: brittle and runtime-dependent.

## Risks / Trade-offs

- [Test parity gaps after migrating from `bun:test`] -> Mitigation: run full suite under Vitest and adjust only framework-specific assertions/imports.
- [Node ESM/TS execution edge cases] -> Mitigation: keep `type: module`, use `tsx` directly for script entrypoints, and validate `npm run setup` behavior.
- [Contributor confusion during transition] -> Mitigation: update README commands and hooks in the same change.
- [Residual Bun references] -> Mitigation: search-and-remove all `bun`, `bunx`, and `bun:test` usages in repo config/docs/tests.

## Migration Plan

1. Update package scripts and dependencies to Node.js + npm tooling.
2. Migrate tests from `bun:test` imports to Vitest imports.
3. Update installer entrypoint check for Node compatibility.
4. Update Husky hook command from `bunx` to npm-compatible execution.
5. Update README command examples.
6. Remove Bun version marker/config references.
7. Validate with npm commands (`npm run typecheck`, `npm test`, `npm run setup` dry run).

Rollback strategy:
- Revert this change set to restore Bun scripts/hooks/tests if migration issues surface.

## Open Questions

- Which Node.js version should be declared in `engines.node` for team compatibility (for example, 20 LTS vs 22 LTS)?
