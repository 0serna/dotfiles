---
name: simplify
description: >-
  Simplify code, a requested scope, or the current diff without changing
  behavior. Use when the user asks to simplify, clean up, reduce complexity, or
  make high-confidence clarity and maintainability improvements.
---

# Simplify

Simplify the requested code or the current diff by making high-confidence clarity and maintainability improvements while preserving exact behavior.

## Workflow

1. Determine scope:
   - If no explicit scope is provided, simplify current working tree changes.
   - If files, paths, or a well-defined scope are provided, use that scope.
   - If the scope is ambiguous, ask for clarification before proceeding.
2. Read before writing; do not guess from filenames alone.
3. Identify only high-confidence simplifications.
4. Use the simplification ladder; stop at the first rung that applies:
   - Does this need to exist at all?
   - Does the standard library already cover it?
   - Does the platform or framework already cover it?
   - Does an already-installed dependency cover it?
   - Can the same behavior be expressed more directly?
   - Only then, make the minimum code change that preserves behavior.
5. If there are no high-confidence simplifications, say `Lean already. Ship.` and do not edit files.
6. Apply the smallest correct edits.
7. Run the project's relevant verification commands.
8. Report what was simplified and what verification ran.

## Rules

- Preserve functionality exactly.
- Do not commit or stage changes.
- Follow the project's local conventions and nearby code.
- Prefer explicit, straightforward code over compact or clever code.
- Keep the change set minimal.
- Reduce unnecessary nesting, branching, and indirection.
- Remove redundant code, helpers, or comments when they do not improve understanding.
- Prefer deletion over replacement when nothing is needed.
- Detect and remove speculative abstractions when safe: one-implementation interfaces, factories with one product, configuration nobody sets, wrappers with one caller, and layers that do not clarify behavior.
- Consolidate related logic only when it improves readability.
- Keep helpful abstractions; do not flatten code blindly.
- Avoid dense one-liners and nested ternaries.
- Do not add dependencies to simplify code; use the standard library, platform features, or already-installed dependencies instead.
- Do not change public behavior, interfaces, persistence formats, or side effects unless the user asked for that.
- Do not reformat unrelated code.
- Do not simplify away security measures, trust-boundary validation, accessibility basics, error handling that prevents data loss, or useful checks/tests.
- Do not revert or overwrite user changes unrelated to the simplification.
- If a possible simplification would change behavior or project structure in a non-trivial way, stop and ask.
- Keep comments rare; use them only where they improve comprehension.

## Output

Return a concise summary with:

- key simplifications made
- verification run and results
- follow-up risk or uncertainty, if applicable
