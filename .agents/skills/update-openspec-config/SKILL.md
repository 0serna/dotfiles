---
name: update-openspec-config
description: Use only to update OpenSpec configuration for OpenCode and Pi. Do not use for normal OpenSpec proposal, exploration, application, or archive workflows.
---

Update generated OpenSpec configuration for OpenCode and Pi only. Run the generators, copy their outputs into the repo, and verify the copies. Do not use this skill for normal OpenSpec workflows.

## Workflow

1. Install the latest OpenSpec CLI:
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```
2. Clean any pre-existing staging directories, then create fresh ones in `/tmp/` for OpenCode and Pi (e.g., `/tmp/openspec-staging-opencode/` and `/tmp/openspec-staging-pi/`).
3. Run `openspec init --tools opencode` in the OpenCode staging directory and `openspec init --tools pi` in the Pi staging directory.
4. Copy the generated OpenCode command files whose names start with `opsx-` from the OpenCode staging `.opencode/commands/` directory into `dotfiles/opencode/commands/`.
5. Copy the generated Pi prompt files whose names start with `opsx-` from the Pi staging `.pi/prompts/` directory into `dotfiles/pi/agent/prompts/`.
6. Copy the generated OpenSpec skill directories whose names start with `openspec-` from `.pi/skills/` into `dotfiles/agents/skills/`:
   - Remove stale `openspec-*` directories from the target before copying.
   - Before copying, verify that the matching directories in `.opencode/skills/` have identical content.
   - If they differ, stop and report the mismatch instead of choosing one silently.
7. Verify the copy by comparing the generated files between source and target:
   - Use `diff -r` on each of the three target directories against their source to confirm content matches.
   - Use `find` with `wc -l` to count files and directories per category.
   - Report the counts and flag any content mismatches.

## Gotchas

- If `openspec init` fails, check that the CLI installed correctly and the tool names (`opencode`, `pi`) are valid in the current version.
- The generated files in `.opencode/commands/` and `.pi/prompts/` always start with `opsx-`. Only copy those; leave other files untouched.
- Cleaning staging directories before starting (step 2) avoids stale state from a previous run.
- If the number of generated files differs from the previous run, the OpenSpec CLI version may have changed. Report the deviation without assuming it is an error.

## Rules

- Always update both OpenCode and Pi in one run.
- Always use `/tmp/` for staging directories.
- Do not manually rewrite generated content.
- Do not use this skill for regular OpenSpec proposal, exploration, apply, or archive workflows.
- Keep the copy limited to generated OpenSpec outputs.

## Output

Return a concise summary with:

- update result for OpenCode and Pi
- copied command, prompt, and skill counts
- verification results, including any count deviations
- any tool-reference findings
