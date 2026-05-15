---
description: Simplify code without changing behavior
---

Simplify the requested code or the current diff by making high-confidence clarity and maintainability improvements while preserving exact behavior.

## Arguments

```arguments
$ARGUMENTS
```

- **No arguments provided**: Inspect current changes.
- **Clear arguments** (files, paths, or a well-defined scope): Use that scope.
- **Unclear or ambiguous arguments**: Stop and ask the user for clarification before proceeding.

## Workflow

1. Determine scope:
   - No arguments: simplify current working tree changes
   - Arguments: simplify the requested scope/files
2. Identify only high-confidence simplifications.
3. Apply the smallest correct edits.
4. Run the project's relevant verification commands.
5. Report what was simplified.

## Rules

- Only apply simplifications but do not commit or add to staging.
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
- Keep comments rare; use them only where they improve comprehension.

## Output

Return a concise summary with:

- key simplifications made
- verification run and results
- any follow-up risk or uncertainty, if applicable
