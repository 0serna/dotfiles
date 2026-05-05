---
description: Update OpenSpec to the latest version
---

## Arguments

No arguments expected.

## Task

Update the repository's OpenSpec-generated opencode commands and skills to the latest version.

## Workflow

1. Run `npm install -g @fission-ai/openspec@latest` from the repo root.
2. Create a temporary staging directory outside the repository, such as `/tmp/opencode/openspec-update`, and run `openspec init --tools opencode` from that staging directory.
3. The command will create `<staging>/.opencode/` with updated commands and skills. Do not use the repository's `.opencode/` directory as staging because it contains repo-local OpenCode commands.
4. Copy or replace all files from `<staging>/.opencode/commands/` into `dotfiles/opencode/commands/`. Create the target directory if it doesn't exist.
5. Replace all skill directories from `<staging>/.opencode/skills/` into `dotfiles/agents/skills/`. Create the target directory if it doesn't exist. Remove any existing OpenSpec skill directories (`openspec-*`) in the target before copying to prevent stale nested subdirectories from previous runs:

   ```bash
   rm -rf dotfiles/agents/skills/openspec-*
   cp -r /tmp/opencode/openspec-update/.opencode/skills/* dotfiles/agents/skills/
   ```

6. Review Claude Code-specific tool references in generated files only (`opsx-*` commands and `openspec-*` skills). Leave casing-only differences, such as `Bash tool` versus `bash tool`, unchanged.
7. Manually rewrite OpenCode-incompatible terms, such as `AskUserQuestion tool`. For `Task tool`, replace subagent delegation with direct instructions for the current agent to read, search, and edit as needed.
8. Verify the copy by listing both source and target directories — file counts should match. Also grep both target directories for remaining Claude Code-specific tool references that need manual review (`AskUserQuestion`, `Task`, etc.).
9. Delete only the temporary staging directory when finished. Do not delete the repository's `.opencode/` directory.

## Rules

- Run repository update and verification commands from the repo root. Run `openspec init --tools opencode` from the temporary staging directory so generated files do not overwrite repo-local OpenCode commands.
- Replace generated command and skill files with the latest OpenSpec output.
- Review Claude Code-specific tool references in all copied `.md` files before verification.
- Leave casing-only tool name differences unchanged.
- Rewrite `Task tool` instructions to remove subagent delegation rather than replacing the term literally.
- Do not delete the repository's `.opencode/` directory.
- Do not leave the temporary staging directory behind.

## Output

Return a concise summary with:

- OpenSpec update result
- copied command and skill counts
- tool reference review result (any Claude Code-specific terms requiring manual handling)
- cleanup result
