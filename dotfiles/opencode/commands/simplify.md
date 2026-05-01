---
description: Simplify code without changing behavior
---

## Arguments

```text
$ARGUMENTS
```

- **No arguments provided**: Inspect current uncommitted changes (`git status`, `git diff`).
- **Clear arguments** (files, paths, or a well-defined scope): Use that scope.
- **Unclear or ambiguous arguments**: Stop and ask the user for clarification before proceeding.

## Task

Refine code for clarity, consistency, and maintainability while preserving exact behavior.

## Workflow

1. Determine the target scope from **Arguments**.
2. Read the relevant files fully before editing.
3. Identify only high-confidence simplifications.
4. Apply the smallest correct edits.
5. Run the project's relevant verification commands after editing.
6. Report what was simplified and any verification results.

## Rules

- Preserve functionality exactly.
- Make code easier to read and maintain.
- Follow the project's local conventions and nearby code.
- Prefer explicit, straightforward code over compact or clever code.
- Keep the change set minimal.
- Reduce unnecessary nesting, branching, and indirection.
- Remove redundant code, helpers, or comments when they do not improve understanding.
- Consolidate related logic when it improves readability.
- Keep helpful abstractions; do not flatten code blindly.
- Avoid dense one-liners and nested ternaries.
- Prefer names and control flow that are obvious to a future reader.
- Do not change public behavior, interfaces, persistence formats, or side effects unless the user asked for that.
- Do not reformat unrelated code.
- Read before writing; do not guess from filenames alone.
- Do not revert or overwrite user changes unrelated to the simplification.
- If a possible simplification would change behavior or project structure in a non-trivial way, stop and ask.
- Keep comments rare and only where they improve comprehension.

## Output

Return a concise summary with:

- scope simplified
- key simplifications made
- verification run and results
- any follow-up risk or uncertainty, if applicable
