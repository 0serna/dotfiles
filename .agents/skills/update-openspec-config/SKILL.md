---
name: update-openspec-config
disable-model-invocation: true
description: Refresh generated OpenSpec skills from the latest OpenSpec CLI.
---

Refresh generated OpenSpec skill files from the latest CLI without manually rewriting generated content.

## Workflow

1. Install the latest OpenSpec CLI:
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```
   Complete when `openspec --version` succeeds.
2. Create a clean staging directory under `/tmp/`.
   Complete when the staging directory exists and contains no state from a previous run.
3. Run `openspec init --tools pi` in the staging directory.
   Complete when the staging directory contains generated `.pi/skills/openspec-*` directories.
4. Replace generated target skills in `dotfiles/agents/skills/`.
   - Remove existing target directories matching `openspec-*`.
   - Copy generated source directories matching `openspec-*`, except `openspec-explore`.
     Complete when the target contains only the copied generated OpenSpec skill directories and no `openspec-explore` directory.
5. Verify the copied skills.
   - Compare every copied target directory with its matching source directory using `diff -r`.
   - Count source `openspec-*` directories excluding `openspec-explore`.
   - Count copied target `openspec-*` directories.
     Complete when every copied directory has a clean diff, the target count equals the expected source count, and stale generated target directories are absent.

## Failure handling

- If `openspec init` fails, verify that the CLI installed correctly and that `pi` is a valid tool name in the installed version.
- If the generated skill count changed from the previous repo state, report the deviation without assuming it is an error.

## Output

Return a concise summary with:

- update result
- copied skill count
- verification results, including any count deviations
