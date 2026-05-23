---
name: update-openspec-config
description: Use only to update shared generated OpenSpec skills. Do not use for normal OpenSpec proposal, exploration, application, or archive workflows.
---

Update generated OpenSpec skill files. Run the generator, copy the shared skills into the repo, and verify the copies. Do not use this skill for normal OpenSpec workflows.

## Workflow

1. Install the latest OpenSpec CLI:
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```
2. Clean any pre-existing staging directory, then create a fresh one in `/tmp/` (e.g., `/tmp/openspec-staging/`).
3. Run `openspec init --tools pi` in the staging directory.
4. Copy generated OpenSpec skill directories from `.pi/skills/` into `dotfiles/agents/skills/`:
   - Remove stale `openspec-*` directories from the target before copying.
   - Copy only directories whose names start with `openspec-`.
   - Exclude `openspec-explore`.
5. Verify the copied skills:
   - Use `diff -r` to compare each copied target skill directory against its matching source directory.
   - Confirm `openspec-explore` is absent from the target.
   - Use `find` with `wc -l` to count the copied skill directories.
   - Report the counts and flag any content mismatches.

## Gotchas

- If `openspec init` fails, check that the CLI installed correctly and the tool name (`pi`) is valid in the current version.
- The generated skill directories always start with `openspec-`. Only copy those; leave other directories untouched.
- Cleaning the staging directory before starting (step 2) avoids stale state from a previous run.
- If the number of generated skill directories differs from the previous run, the OpenSpec CLI version may have changed. Report the deviation without assuming it is an error.

## Rules

- Always use `/tmp/` for the staging directory.
- Do not manually rewrite generated content.
- Do not use this skill for regular OpenSpec proposal, exploration, apply, or archive workflows.
- Keep the copy limited to generated OpenSpec skill outputs.
- Always exclude `openspec-explore` from the copied skills.

## Output

Return a concise summary with:

- update result
- copied skill count
- verification results, including any count deviations
- any tool-reference findings
