---
name: simplify
description: >-
  Simplify code, functions, documentation, or the current diff without behavior
  changes. Use when the user asks to simplify, reduce complexity, deduplicate,
  remove dead or orphaned code, prefer native/existing utilities, or make lean
  maintainability improvements.
---

# Simplify

Simplify by making the scoped work leaner without changing observable behavior.

## Workflow

1. Lock scope:
   - If no explicit scope is provided, inspect current working tree changes.
   - If files, paths, symbols, docs, or a diff range are provided, use them.
   - If scope or intended behavior is ambiguous, ask before editing.
   - Complete when the exact files, symbols, or diff hunks to inspect are known.
2. Read every in-scope file or diff hunk before writing.
   - Include nearby callers, imports, exports, tests, and docs when needed to prove behavior is preserved.
   - Complete when each candidate change has enough context to classify as safe or unsafe.
3. Build a candidate list with the lean ladder; stop at the first safe rung that applies:
   - Delete code, comments, docs, imports, exports, files, branches, or parameters that no longer need to exist.
   - Replace custom code with standard library, language, platform, or framework utilities.
   - Replace custom code with already-installed project dependencies.
   - Merge duplicated logic, documentation, or configuration into a single source of truth.
   - Flatten unnecessary nesting, branching, indirection, wrappers, helpers, or abstractions.
   - Express the same behavior more directly with nearby conventions.
   - Complete when every in-scope area has a high-confidence candidate or a reason to leave it unchanged.
4. If there are no high-confidence candidates, say `Lean already. Ship.` and do not edit files.
5. Apply the smallest correct edits.
   - Remove orphaned imports, exports, variables, types, comments, docs references, tests, and unreachable code created by the edits.
   - Complete when the codebase has no leftover references from the simplification.
6. Run the project's quality gate if available; otherwise run applicable tests, typecheck, or lint.
7. Report simplifications, verification, and any remaining risk.

## Rules

- Preserve public behavior, APIs, persistence formats, side effects, accessibility, security boundaries, and error handling that prevents data loss.
- Do not add dependencies; prefer native APIs, platform/framework features, or already-installed dependencies.
- Do not replace clear code with clever code.
- Do not remove comments or documentation that explain non-obvious intent, constraints, or operational knowledge.
- Do not reformat unrelated code.
- Do not commit, stage, revert, or overwrite unrelated user changes.
- If a simplification could change behavior, project structure, or user-facing documentation meaning, ask before editing.

## Output

Return a concise summary with:

- key simplifications made
- verification run and results
