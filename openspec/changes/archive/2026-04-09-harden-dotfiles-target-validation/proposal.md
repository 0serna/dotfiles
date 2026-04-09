## Why

The current dotfiles linker accepts overly broad `target` paths. A malformed manifest can point `target` at the home directory itself or back into the repository, and the installer will remove that path recursively before creating the symlink.

## What Changes

- Tighten target validation before any filesystem removal happens.
- Reject `target` values that resolve to the home directory root.
- Reject `target` values that resolve inside the repository tree.
- Preserve normal dotfiles paths such as `~/.config/...`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `generic-dotfiles`: target resolution and replacement behavior must be safe against destructive paths.

## Impact

- `src/installer.ts` target resolution and deletion flow.
- Tests covering manifest targets and safety checks.
- The existing `generic-dotfiles` spec.
