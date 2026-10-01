# Proposal

## Why

Pi's global settings are outside the repository, and Pi does not yet receive the shared global `AGENTS.md`. A minimal integration will make the existing configuration restorable and establish a place for future personal extensions without taking ownership of Orca's extensions or Pi's runtime data.

## What Changes

- Version the current `~/.pi/agent/settings.json` as `dotfiles/pi/settings.json`, preserving every field and value, including `deviceId` and `lastChangelogVersion`.
- Add file-level manifest links for that settings file and for `dotfiles/AGENTS.md` at `~/.pi/agent/AGENTS.md`.
- Prepare `dotfiles/pi/extensions/` for future personal extensions. Each future extension will have its own explicit manifest entry, rather than linking the shared extensions directory.
- Exclude Orca-managed `orca-*` extensions from the repository and leave their installed files untouched.
- Document the ownership boundary and add installer regression tests for the links, repeated installation, and preservation of unmanaged files.

## Capabilities

### New Capabilities

- `pi-config`: Version and link Pi's global settings and shared instructions while preserving local runtime data and Orca-managed extensions.

### Modified Capabilities

None. Existing OpenCode configuration and shared-skill behavior remain unchanged.

## Impact

- Affects `dotfiles.json`, a new `dotfiles/pi/` directory, `.gitignore`, `src/installer/dotfiles-installer.test.ts`, `README.md`, and the repository layout in `AGENTS.md`.
- Reuses the existing manifest and linker without changes to installer behavior or dependencies.
- Continues to use `~/.agents/skills/`, which Pi already discovers. No Pi-specific skill directory, link, or resource-path setting is needed.
- Excludes `auth.json`, `models-store.json`, `trust.json`, sessions, managed binaries, and installation data. Custom models, MCP servers, keybindings, prompts, themes, system-prompt overrides, and actual extension implementations are outside this change.
