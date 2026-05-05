---
name: opencode-commands
description: Create, review, and maintain opencode command files using the shared command structure. Use when adding or updating opencode commands.
---

# OpenCode Commands

Use this skill when creating, reviewing, or updating opencode command files.

The goal is consistency: every local command should be easy to scan, predictable to maintain, and explicit about inputs, behavior, constraints, and expected output.

## Scope

- Apply these guidelines to opencode command files in the current project.
- Discover the project's command directory from existing files, configuration, or user instructions before creating new command files.
- Do not apply these guidelines to `opsx-*` commands unless the user explicitly asks.
- Preserve a command's purpose unless the user asks for a behavior change.
- Improve ambiguous instructions when doing so makes the command safer or easier to execute.

## Required Structure

Every non-`opsx-*` command should use this section order:

```markdown
---
description: ...
[other frontmatter only when needed]
---

## Arguments

...

## Task

...

## Workflow

...

## Rules

...

## Output

...
```

## Frontmatter

- `description` is required.
- Keep descriptions concise and action-oriented.
- Preserve other frontmatter keys, such as `model` or `subtask`, when they are already needed.
- Do not add new frontmatter keys unless they are required for the command to behave correctly.

## Arguments

- Commands that accept input should include:

````markdown
```text
$ARGUMENTS
```
````

- Explain how to handle no arguments, clear arguments, and ambiguous arguments when relevant.
- Commands that do not expect input should use plain text:

```markdown
No arguments expected.
```

- Fold scope selection into `Arguments`; do not create a separate `Scope Selection` section.

## Task

- State what the command does in one short paragraph or a compact bullet list.
- Keep the task focused on the command's purpose.
- Avoid implementation details that belong in `Workflow`.

## Workflow

- Put executable steps here.
- Use ordered lists for sequential steps.
- Keep specialized procedures in this section instead of creating custom top-level sections.
- If the command has branches, describe the decision point first, then the branch-specific actions.

## Rules

- Put constraints, guardrails, safety requirements, message rules, and review criteria here.
- Preserve safety-sensitive rules, especially around git, destructive actions, reviews, and external commands.
- Do not bury critical prohibitions in `Workflow` if they are better expressed as rules.
- Prefer concrete rules over vague preferences.

## Output

- Describe what the assistant should return after running the command.
- Output can be flexible per command; do not force a single global response format.
- Use strict output formats only when the command depends on exact formatting.
- Include verification results when the command edits files or runs checks.

## Maintenance Workflow

When updating existing commands:

1. Read the full command before editing.
2. Identify the current purpose, inputs, workflow, guardrails, and output expectations.
3. Reorganize content into the required structure.
4. Preserve behavior unless an instruction is ambiguous or unsafe.
5. Keep edits minimal and command-specific.
6. Do not touch `opsx-*` commands unless explicitly requested.
7. Run the project's configured checks after editing when available.

## Creation Workflow

When creating a new command:

1. Clarify the command name, purpose, expected arguments, and safety constraints if they are not obvious.
2. Create the command in the project's opencode commands directory using the existing command filename pattern.
3. Use the required structure from the start.
4. Keep the first version narrow and explicit.
5. Add only the rules needed to make the command safe and repeatable.
6. Run the project's configured checks after editing when available.

## Quality Bar

- The command should be readable top to bottom without hidden assumptions.
- The structure should be consistent with neighboring commands.
- Rules should prevent known failure modes without over-constraining normal use.
- Workflow steps should be actionable by an assistant in the shared workspace.
- Output instructions should tell the assistant what to report, not how to over-explain.
