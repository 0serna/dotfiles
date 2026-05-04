---
description: Update opencode plugins and MCP binaries to latest versions
---

## Arguments

No arguments expected.

## Task

Update all pinned opencode plugins listed in `opencode.jsonc` and `tui.jsonc` to their latest npm versions. Also update pinned MCP packages that provide local binaries to their latest npm versions, keeping the installed global binary package in sync.

## Workflow

1. Read `dotfiles/opencode/opencode.jsonc` and `dotfiles/opencode/tui.jsonc`.
2. Extract pinned plugin entries from both `plugin` arrays. Each pinned entry follows the format `name@version`.
3. Extract pinned MCP package references from both config files when they use npm package references, such as `name@version`, `npx name@version`, or local binary commands backed by a globally installed npm package.
4. For each unique pinned npm package, run `npm view <name> version` to get the latest published version.
5. Compare the latest version against the pinned version in the config files.
6. If any plugin or MCP package has a newer version available, present a summary table showing package type, package name, current version, and latest version. Ask the user for confirmation before proceeding.
7. Update each config file's pinned plugin and MCP package references with the new versions.
8. For each updated package with a corresponding local binary, verify the installed global version with `npm list -g <name>`. If it is missing or doesn't match the target version, run `npm install -g <name>@<version>`.

## Rules

- Only update plugins and MCP package references with explicit `@version` pinning. Unpinned entries are skipped.
- Only update global npm packages for MCP entries that use local binaries or otherwise require a locally installed executable.
- Run all npm and verification commands from the repo root.

## Output

Return a concise summary with:

- plugins and MCP packages checked, including their version status (up-to-date or updated)
- global binary update result for each applicable package
- verification command and result
