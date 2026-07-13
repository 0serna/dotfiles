---
name: simplify
description: >-
  Lean code, docs, or the current diff — drop dead code, dedupe, prefer
  native utilities, flatten wrappers. Use when the user says simplify, dedupe,
  clean up, or remove dead code.
---

# Simplify

Make the scoped work leaner without changing observable behavior. Inspect, list candidates, apply the smallest correct edits, verify, report.

## Workflow

1. **Lock scope**
   - If files, paths, symbols, docs, or a diff range are given, use them.
   - Otherwise treat the current working tree (staged, unstaged, untracked) as scope and read every changed file.
   - Complete when every changed file is identified and the file list is final.

2. **Read in-scope files**
   - Read every candidate file or diff hunk before writing.
   - Follow imports, callers, tests, and docs far enough to confirm a change preserves behavior.
   - Complete when each candidate is classified safe or unsafe.

3. **Build candidates with the lean ladder**
   Stop at the first rung that yields a high-confidence, behavior-preserving edit:
   - **Delete** code, comments, docs, imports, exports, files, branches, or parameters that no longer need to exist.
   - **Rename** symbols to be self-describing; delete the comments the rename made redundant.
   - **Replace** custom code with standard library, language, platform, or framework utilities.
   - **Replace** custom code with already-installed project dependencies.
   - **Merge** duplicated logic, docs, or configuration into one source of truth.
   - **Flatten** unnecessary nesting, branching, indirection, wrappers, helpers, or abstractions.
   - **Express** the same behavior more directly with nearby conventions.

4. **No candidates → stop.** If nothing in scope earns a high-confidence edit, return `Lean already. Ship.` and do not edit.

5. **Apply the smallest correct edits**
   - Touch only the lines the candidate covers.
   - Remove orphaned imports, exports, variables, types, comments, docs, tests, and unreachable code created by the edit.
   - Complete when the working tree has no leftover references from the simplification.

6. **Verify**
   - Run the project's quality gate when one exists.
   - Otherwise run the tests, typecheck, or lint that cover the touched code.
   - If verification fails, fix the regression before reporting; the simplification is not done until it passes.

7. **Report**
   - State the scope locked in step 1 so the user can redirect in one round.
   - List the simplifications made and the lean-ladder rung each came from.
   - State what verification ran and the result.
   - Surface any candidate that was rejected because it would change behavior.

## Guardrails

- Preserve public behavior, APIs, persistence formats, side effects, accessibility, security boundaries, and error handling.
- Prefer already-installed dependencies and native APIs; do not add new ones.
- Stay obvious. Clever code is not simpler.
- Prefer self-describing names over comments; delete the comments a rename makes redundant. Keep a comment only when the information cannot physically live in a name (external constraint, bug-tracker reference, regulatory requirement).
- Proceed immediately with the default scope (working tree) when none is given.
- Do not commit, stage, revert, or stash user changes.
- A candidate that changes behavior, structure, or user-facing meaning is **not** a simplification. Surface it in the report and do not apply it.
