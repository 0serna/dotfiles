## Why

The repository currently manages Pi dotfiles with a layout that does not fully match the actual destination under `~/.pi`. In particular, `dotfiles/pi/prompts` and `dotfiles/pi/extensions` are stored outside `agent/` even though they are linked into `~/.pi/agent/...`, which makes the managed subset harder to inspect and reason about.

## What Changes

- Reorganize the repository-managed Pi dotfiles so `dotfiles/pi` mirrors the shareable subset of `~/.pi`.
- Move Pi prompt templates and extensions under `dotfiles/pi/agent/` to match their destination paths.
- Keep repository-managed Pi state limited to shareable configuration and exclude runtime or machine-local data such as auth, sessions, and generated binaries.
- Update the root dotfile manifest so Pi links still resolve to the same destination files after the repository layout change.

## Capabilities

### New Capabilities

- `pi-dotfiles-layout`: Define the repository-managed layout for Pi configuration, including which `~/.pi` paths are mirrored and which runtime paths are intentionally excluded.

### Modified Capabilities

- `generic-dotfiles`: The manifest entries for Pi-managed files change to point at the new repository paths while preserving the same linked destination paths.

## Impact

- Affected repository paths under `dotfiles/pi/`
- `dotfiles.json` manifest entries for Pi
- OpenSpec requirements for repository-managed dotfiles and Pi layout expectations
