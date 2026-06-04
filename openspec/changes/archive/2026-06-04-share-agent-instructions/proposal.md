## Why

OpenCode and Pi Agent currently maintain separate `AGENTS.md` files with overlapping guidance, which creates drift and makes updates harder to reason about. A shared source file makes the cross-agent instructions explicit while still installing each tool's expected destination path.

## What Changes

- Move the shared agent instruction source to `dotfiles/AGENTS.md`.
- Update the default manifest so both OpenCode and Pi Agent `AGENTS.md` targets link from `dotfiles/AGENTS.md`.
- Remove the duplicated per-tool source files for the shared instructions.
- Preserve tool-specific destination paths: `~/.config/opencode/AGENTS.md` and `~/.pi/agent/AGENTS.md`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `generic-dotfiles`: The default manifest will support one shared source file linked to multiple agent instruction targets, with an explicit exception to the mirrored Pi source-path rule for shared `AGENTS.md` content.
- `pi-dotfiles-layout`: The managed Pi layout will allow `~/.pi/agent/AGENTS.md` to come from the shared `dotfiles/AGENTS.md` source while keeping prompts and extensions mirrored under `dotfiles/pi/agent`.

## Impact

- Affected files: `dotfiles.json`, `dotfiles/AGENTS.md`, `dotfiles/opencode/AGENTS.md`, `dotfiles/pi/agent/AGENTS.md`, and installer tests covering the default manifest/link behavior.
- No runtime dependency or API changes.
- Existing installs will relink both destination files to the shared source on the next `npm run link`.
