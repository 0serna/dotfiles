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
4. Apply the smallest correct edits.
5. Run the project's relevant verification commands.
6. Report what was simplified and what verification ran.

## Rules

- Preserve functionality exactly.
- Do not commit or stage changes.
- Follow the project's local conventions and nearby code.
- Prefer explicit, straightforward code over compact or clever code.
- Keep the change set minimal.
- Reduce unnecessary nesting, branching, and indirection.
- Remove redundant code, helpers, or comments when they do not improve understanding.
- Consolidate related logic only when it improves readability.
- Keep helpful abstractions; do not flatten code blindly.
- Avoid dense one-liners and nested ternaries.
- Do not change public behavior, interfaces, persistence formats, or side effects unless the user asked for that.
- Do not reformat unrelated code.
- Do not revert or overwrite user changes unrelated to the simplification.
- If a possible simplification would change behavior or project structure in a non-trivial way, stop and ask.
- Keep comments rare; use them only where they improve comprehension.

## Output

Return a concise summary with:

- key simplifications made
- verification run and results
- follow-up risk or uncertainty, if applicable
