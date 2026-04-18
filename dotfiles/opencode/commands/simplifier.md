---
description: Simplify recent code without changing behavior
---

## Input

```text
$ARGUMENTS
```

## Task

Refine recently modified code for clarity, consistency, and maintainability while preserving exact behavior.

Default scope: code changed in the current worktree or touched in this session.

If the user provides a file, path, diff, or broader scope in `$ARGUMENTS`, use that instead.

## Goals

1. Preserve functionality exactly.
2. Make code easier to read and maintain.
3. Follow the project's local conventions from `AGENTS.md` and nearby code.
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

1. Determine the target scope.
   - If `$ARGUMENTS` names files or directories, inspect those.
   - Otherwise inspect local changes first with git-based context.
2. Read the relevant files fully before editing.
3. Identify only high-confidence simplifications.
4. Apply the smallest correct edits.
5. Run the project's relevant verification commands after editing.
6. Report what was simplified and any verification results.

## Git Context

When no explicit scope is provided, use these commands to identify candidate files:

- `git status --short`
- `git diff --stat`
- `git diff`

Prefer simplifying files with active unstaged or staged changes. If there are no local changes, state that clearly and ask the user for a target.

## Editing Guardrails

- Read before writing; do not guess from filenames alone.
- Use `apply_patch` for manual edits.
- Do not revert or overwrite user changes unrelated to the simplification.
- If a possible simplification would change behavior or project structure in a non-trivial way, stop and ask.
- Keep comments rare and only where they improve comprehension.

## Output

Return a concise summary with:

- scope simplified
- key simplifications made
- verification run and results
- any follow-up risk or uncertainty, if applicable
