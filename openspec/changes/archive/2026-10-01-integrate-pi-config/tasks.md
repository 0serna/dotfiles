# Tasks

## 1. Repository configuration

- [x] 1.1 Capture the current `~/.pi/agent/settings.json` before replacing any target and adopt it as `dotfiles/pi/settings.json`. Verify JSON parsing and deep equality with the captured configuration, including `deviceId`, `lastChangelogVersion`, and every other existing field.
- [x] 1.2 Add the two file-level manifest entries for Pi settings and shared `AGENTS.md`. Verify that the existing manifest entries remain unchanged and that no whole-agent, whole-extensions, runtime-data, Orca, or Pi-skills target is declared.
- [x] 1.3 Create an empty `dotfiles/pi/extensions/.gitkeep` without an extension manifest entry and add `/dotfiles/pi/extensions/orca-*` to `.gitignore`. Verify the placeholder exists, `git check-ignore --no-index` matches an Orca extension path, and it does not match a personal extension path or `.gitkeep`.

## 2. Installer regression tests

- [x] 2.1 Add tests in `src/installer/dotfiles-installer.test.ts` that check the real manifest's two Pi entries and guard against forbidden directory, runtime-data, Orca, and Pi-skills targets. Verify these tests pass with `npm test -- src/installer/dotfiles-installer.test.ts`.
- [x] 2.2 Add temporary-home fixtures for fresh installation and replacement of existing managed files, followed by a second installation. Verify symlink destinations, success on both runs, and common instruction contents across Pi, OpenCode, and Codex with the focused installer tests.
- [x] 2.3 Seed unmanaged sentinel files for credentials, model cache, trust decisions, sessions, binaries, installation data, and all three current Orca extension names in a temporary home. Verify two installations preserve their contents and leave the agent and extensions directories as real directories with the focused installer tests.
- [x] 2.4 Add a fixture-only personal extension and its individual manifest entry alongside an Orca extension. Verify linking and relinking create the personal file symlink without changing the Orca file or replacing the shared extensions directory. Do not add an actual production extension.

## 3. Documentation

- [x] 3.1 Update `README.md` to document Pi's managed paths, per-extension manifest entries, Orca exclusions, existing shared-skill discovery, settings writes through the symlink, and backup and reload instructions. Verify its layout matches the manifest and it does not suggest linking the whole agent or extensions directory.
- [x] 3.2 Update the repository structure in root `AGENTS.md` to include `dotfiles/pi/` using the `agents-md` and `writing-for-agents` skills. Verify the documented paths exist and keep the existing command list unchanged.

## 4. Integration verification

- [x] 4.1 Run `npm test`, `npm run check`, and `npm run typecheck`. Verify all pass, the adopted settings still contain every captured field and value, and no credentials, runtime files, or Orca extensions entered the repository. Use temporary-home installation tests for acceptance; do not run `npm run link` against the active home solely to validate the change.
