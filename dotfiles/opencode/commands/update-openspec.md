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
5. Replace all skill directories from `.opencode/skills/` into `dotfiles/agents/skills/`. Create the target directory if it doesn't exist. Remove any existing OpenSpec skill directories (`openspec-*`) in the target before copying to prevent stale nested subdirectories from previous runs:

   ```bash
   rm -rf dotfiles/agents/skills/openspec-*
   cp -r .opencode/skills/* dotfiles/agents/skills/
   ```

6. Fix Claude Code nomenclature: replace tool references in OpenSpec-generated files only (`opsx-*` commands and `openspec-*` skills). Run from the repo root:

   ```bash
   find dotfiles/opencode/commands/opsx-*.md dotfiles/agents/skills/openspec-* -name '*.md' -exec sed -i \
     -e 's/AskUserQuestion tool/question tool/g' \
     -e 's/TodoWrite tool/todowrite tool/g' \
     -e 's/Task tool/task tool/g' \
     -e 's/Skill tool/skill tool/g' \
     -e 's/Bash tool/bash tool/g' \
     -e 's/Read tool/read tool/g' \
     -e 's/Write tool/write tool/g' \
     -e 's/Edit tool/edit tool/g' \
     -e 's/Grep tool/grep tool/g' \
     -e 's/Glob tool/glob tool/g' \
     -e 's/WebFetch tool/webfetch tool/g' \
     -e 's/NotebookEdit tool/use the appropriate tool for notebook editing/g' \
     {} +
   ```

7. Verify the copy by listing both source and target directories — file counts should match. Also grep both target directories for any remaining PascalCase Claude Code tool names (`AskUserQuestion`, `TodoWrite`, `NotebookEdit`, etc.) to confirm the fix worked.
8. Delete the `.opencode` directory created at the repo root when finished.

## Rules

- Run all commands from the repo root.
- Replace generated command and skill files with the latest OpenSpec output.
- Fix Claude Code tool nomenclature in all copied `.md` files before verification.
- Do not leave the temporary `.opencode` directory behind.

## Output

Return a concise summary with:

- OpenSpec update result
- copied command and skill counts
- nomenclature fix result (any remaining Claude Code terms found)
- cleanup result
