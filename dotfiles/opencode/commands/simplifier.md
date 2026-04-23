---
description: Simplify code without changing behavior
---

## Arguments

```text
$ARGUMENTS
```

## Task

Refine code for clarity, consistency, and maintainability while preserving exact behavior.

## Scope Selection

- **No arguments provided**: Inspect current uncommitted changes (`git status`, `git diff`).
- **Arguments are clear** (files, paths, or a well-defined scope): Use that scope.
- **Arguments are unclear or ambiguous**: Stop and ask the user for clarification before proceeding.

## Goals

1. Preserve functionality exactly.
2. Make code easier to read and maintain.
3. Follow the project's local conventions and nearby code.
4. Prefer explicit, straightforward code over compact or clever code.
5. Keep the change set minimal.

## Simplification Rules

- Reduce unnecessary nesting, branching, and indirection.
- Remove redundant code, helpers, or comments when they do not improve understanding.
- Consolidate related logic when it improves readability.
- Keep helpful abstractions; do not flatten code blindly.
- Avoid dense one-liners and nested ternaries.
- Prefer names and control flow that are obvious to a future reader.
- Do not change public behavior, interfaces, persistence formats, or side effects unless the user asked for that.
- Do not reformat unrelated code.

## Workflow

1. Determine the target scope based on **Scope Selection** above.
2. Read the relevant files fully before editing.
3. Identify only high-confidence simplifications.
4. Apply the smallest correct edits.
5. Run the project's relevant verification commands after editing.
6. Report what was simplified and any verification results.

## Editing Guardrails

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
