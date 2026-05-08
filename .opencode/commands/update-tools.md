---
description: Update OpenCode plugins, MCPs, skills, and CLI tools
---

Update pinned OpenCode plugins, MCP package references, global skills, and related global CLI tools to their latest compatible versions. Keep local binary installations in sync and report what changed.

## Workflow

1. Discover pinned config packages:
   - Read `dotfiles/opencode/opencode.jsonc` and `dotfiles/opencode/tui.jsonc`.
   - Extract pinned plugin entries from both `plugin` arrays. Each pinned entry follows the format `name@version`.
   - Extract pinned MCP package references from both config files when they use npm package references, such as `name@version`, `npx name@version`, or local binary commands backed by a globally installed npm package.
2. Check available versions:
   - For each unique pinned npm package, run `npm view <name> version` to get the latest published version and compare it with the pinned version.
   - For `playwriter`, run `playwriter --version` to get the installed version and `npm view playwriter version` to get the latest.
   - For `rtk`, run `rtk --version` to get the installed version and `brew info rtk --json=v2` to get the latest.
3. If any plugin, MCP package, or related global CLI tool has a newer version available, present a summary table showing package type, package name, current version, and latest version. Ask the user for confirmation before applying those updates.
4. Apply confirmed updates, continuing with independent update groups when possible if one group fails:
   - Update each config file's pinned plugin and MCP package references with the new versions.
   - For each updated package with a corresponding local binary, verify the installed global version with `npm list -g <name>`. If it is missing or doesn't match the target version, run `npm install -g <name>@<version>`.
   - If `playwriter` has a newer version available, run `npm install -g playwriter@latest`.
   - If `rtk` has a newer version available, run `brew upgrade rtk`.
5. Update globally installed skills by running `npx skills update -g -y`. Do this even when no other updates are available, and do not ask for extra confirmation when skills are the only update action.
6. Run the repository's relevant verification command once after updates finish.

## Rules

- Only update plugins and MCP package references with explicit `@version` pinning. Unpinned entries are skipped.
- Only update global npm packages for MCP entries that use local binaries or otherwise require a locally installed executable.
- Run all npm and verification commands from the repo root.
- Do not roll back successful updates if a later independent update fails.
- Report partial updates and failures explicitly.

## Output

Return a concise summary focused on what changed:

- updated plugins and MCP packages, showing `name: old version -> new version`
- updated global binaries, showing `name: old version -> new version`
- global skills update result
- files changed
- failures or skipped updates, if any
- verification command and result
