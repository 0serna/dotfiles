## 1. Shared Source Layout

- [x] 1.1 Create `dotfiles/AGENTS.md` with the canonical shared agent instructions, using the current Pi Agent wording as the baseline.
- [x] 1.2 Remove the duplicated `dotfiles/opencode/AGENTS.md` and `dotfiles/pi/agent/AGENTS.md` source files.

## 2. Manifest Linking

- [x] 2.1 Update the OpenCode `AGENTS.md` manifest entry to use `dotfiles/AGENTS.md` as its source while preserving `~/.config/opencode/AGENTS.md` as the target.
- [x] 2.2 Update the Pi Agent `AGENTS.md` manifest entry to use `dotfiles/AGENTS.md` as its source while preserving `~/.pi/agent/AGENTS.md` as the target.

## 3. Verification

- [x] 3.1 Add or update tests proving multiple manifest entries can link the same `dotfiles/AGENTS.md` source to distinct targets.
- [x] 3.2 Update tests or assertions that enforce mirrored Pi source paths so they allow the shared `AGENTS.md` exception only.
- [x] 3.3 Run the project check command and fix any failures.
