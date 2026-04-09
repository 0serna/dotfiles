## Why

The repository is currently tied to OpenCode-specific configuration syncing. Turning it into a generic dotfiles repo lets the same workflow manage any agent tool or other dotfiles-backed application from one place.

## What Changes

- Replace the OpenCode-only install flow with a generic symlink-based dotfiles linker.
- Add a root `dotfiles.json` manifest to declare `source` and `target` pairs.
- Move existing OpenCode assets under `dotfiles/opencode/` and keep them as the first example.
- Update the setup command to a generic linking command.
- Preserve idempotent installation behavior while replacing existing targets.

## Capabilities

### New Capabilities
- `generic-dotfiles`: manage arbitrary dotfiles/tool configurations through a manifest-driven symlink workflow.

### Modified Capabilities
- None.

## Impact

- Installer logic in `src/installer.ts`.
- Repository layout under `dotfiles/`.
- Package scripts and documentation.
- Existing OpenCode configuration paths and targets.
