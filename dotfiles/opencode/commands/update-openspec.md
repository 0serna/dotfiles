---
description: Update OpenSpec to the latest version
---

## Arguments

No arguments expected.

## Task

Update the repository's OpenSpec-generated opencode commands and skills to the latest version.

## Workflow

1. Run `npm install -g @fission-ai/openspec@latest` from the repo root.
2. Run `openspec init --tools opencode` from the repo root.
3. The command will create a `.opencode` directory with updated commands and skills.
4. Copy or replace all files from `.opencode/commands/` into `dotfiles/opencode/commands/`. Create the target directory if it doesn't exist.
5. Copy or replace all skill directories from `.opencode/skills/` into `dotfiles/agents/skills/`. Create the target directory if it doesn't exist.
6. Verify the copy by listing both source and target directories — file counts should match.
7. Delete the `.opencode` directory created at the repo root when finished.

## Rules

- Run all commands from the repo root.
- Replace generated command and skill files with the latest OpenSpec output.
- Do not leave the temporary `.opencode` directory behind.

## Output

Return a concise summary with:

- OpenSpec update result
- copied command and skill counts
- cleanup result
