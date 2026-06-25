---
name: simplify
description: >-
  Simplify code, a requested scope, or the current diff without behavior
  changes. Use when the user asks to simplify, reduce complexity, or make lean
  clarity and maintainability improvements.
---

# Simplify

## Workflow

1. Determine scope:
   - If no explicit scope is provided, simplify current working tree changes.
   - If files, paths, or a well-defined scope are provided, use that scope.
   - If the scope is ambiguous, ask for clarification before proceeding.
   - Complete when the exact files or diff range to inspect is known.
2. Read every in-scope file or diff hunk before writing.
3. Build a candidate list by applying the simplification ladder to each in-scope area; stop at the first rung that applies:
   - Does this need to exist at all?
   - Does the standard library already cover it?
   - Does the platform or framework already cover it?
   - Does an already-installed dependency cover it?
   - Can the same behavior be expressed more directly?
   - Complete when each in-scope area has either a high-confidence candidate or a reason to leave it unchanged.
4. If there are no high-confidence candidates, say `Lean already. Ship.` and do not edit files.
5. Apply the smallest correct edits.
6. Run the project's quality gate if available; otherwise run the applicable tests, typecheck, or lint, and state if no verification applies.
7. Report what was simplified and what verification ran.

## Rules

- Preserve public behavior, interfaces, persistence formats, side effects, and functionality exactly unless the user asked for those changes.
- Do not commit, stage, revert, or overwrite unrelated user changes.
- Stay lean: prefer deletion over replacement, straightforward code over clever code, and local edits over broad rewrites.
- Follow nearby conventions and do not reformat unrelated code.
- Remove unnecessary nesting, branching, indirection, helpers, comments, and speculative abstractions when safe.
- Keep helpful abstractions, security checks, trust-boundary validation, accessibility basics, error handling that prevents data loss, and useful tests.
- Do not add dependencies; use the standard library, platform features, or already-installed dependencies.
- If a candidate would change behavior or project structure in a non-trivial way, stop and ask.

## Output

Return a concise summary with:

- key simplifications made
- verification run and results
- follow-up risk or uncertainty, if applicable
