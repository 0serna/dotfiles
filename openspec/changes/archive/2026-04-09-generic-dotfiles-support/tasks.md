## 1. Repository layout and manifest

- [x] 1.1 Create `dotfiles/opencode/` and move the existing OpenCode assets into it
- [x] 1.2 Add root `dotfiles.json` with explicit `source` and `target` entries for the migrated OpenCode files

## 2. Installer updates

- [x] 2.1 Update the installer to read `dotfiles.json` from the repo root
- [x] 2.2 Resolve `source` relative to the repo root and reject paths that escape it
- [x] 2.3 Resolve `target` as an absolute path with `~` expansion and create parent directories
- [x] 2.4 Replace existing target paths with symlinks and stop on the first invalid entry or linking error

## 3. Script and documentation

- [x] 3.1 Rename the setup script to `npm run link`
- [x] 3.2 Update the README to describe the generic dotfiles workflow and new repo layout

## 4. Verification

- [x] 4.1 Update tests to cover manifest parsing, path resolution, replacement behavior, and failure cases
- [x] 4.2 Run the test and typecheck suite to verify the change end to end
