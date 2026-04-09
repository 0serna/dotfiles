## Context

The repo currently behaves like a single-tool config installer for OpenCode. The new goal is a generic dotfiles repository that can link configuration for any tool from a single manifest while keeping the current workflow simple and scriptable.

## Goals / Non-Goals

**Goals:**
- Support multiple tools through one root `dotfiles.json` manifest.
- Link repository files to arbitrary absolute targets with `~` expansion.
- Keep installation idempotent and safe when re-run.
- Preserve the current OpenCode config as the first migrated example.

**Non-Goals:**
- Interactive prompts or confirmation flows.
- Complex manifest features such as ignore rules, templating, or conditional installs.
- Copy-based installs or bidirectional syncing.

## Decisions

### 1. Manifest-first model
Use a single root `dotfiles.json` with a flat array of `{ source, target }` entries.

Rationale: the repo needs to scale across unrelated tools without adding per-tool config conventions. A flat manifest stays easy to parse and reason about.

Alternatives considered:
- Inferring links from directory structure. Rejected because it couples repo layout to installer behavior.
- Grouping entries by tool in the manifest. Rejected because it adds nesting without clear benefit.

### 2. Source paths are repo-relative; targets are system paths
Resolve `source` relative to the repository root and reject traversal outside the repo. Resolve `target` as an absolute path, with `~` expanded to the current home directory.

Rationale: repo-relative sources keep the manifest portable, while absolute targets match how dotfiles are installed on real machines.

Alternatives considered:
- Allowing relative targets. Rejected because it is ambiguous and less portable.
- Allowing arbitrary source escapes. Rejected for safety.

### 3. Symlink-only installation
Create symlinks rather than copying files.

Rationale: symlinks preserve a single source of truth and make updates immediate after edits in the repo.

Alternatives considered:
- Copying files into place. Rejected because it duplicates state and complicates updates.

### 4. Replace existing targets and create parents
If the target path already exists, remove it and replace it with the new symlink. Create missing parent directories automatically.

Rationale: dotfiles workflows should be re-runnable without manual cleanup.

Alternatives considered:
- Failing on existing targets. Rejected because it makes repeated setup brittle.

### 5. Fail fast on invalid entries
Stop on the first malformed manifest entry or linking error.

Rationale: this keeps failure modes obvious and avoids a partially updated config set.

Alternatives considered:
- Continuing after errors. Rejected because it leaves the system in mixed state.

### 6. Keep the repo layout explicit
Store tool assets under `dotfiles/<tool>/...`, starting with `dotfiles/opencode/...`.

Rationale: the directory name makes ownership obvious and supports future tools without special cases.

Alternatives considered:
- Keeping a hidden directory like `dotfiles/.opencode/`. Rejected because it is harder to browse and does not add meaningful value.

## Risks / Trade-offs

- [Changing the repo layout breaks current paths] → Migrate the existing OpenCode files and update the manifest in the same change.
- [Symlink semantics differ across platforms] → Keep the implementation narrow and test on the supported Node.js environment.
- [Replacing target paths can remove user data] → Make replacement explicit in the design and document the behavior clearly.
- [Manifest mistakes can block installation] → Validate entries before linking and fail fast with clear errors.

## Migration Plan

1. Move current OpenCode assets under `dotfiles/opencode/`.
2. Add `dotfiles.json` entries for the migrated OpenCode files and directories.
3. Update the installer to read the manifest and create symlinks from the repo to the target paths.
4. Rename the setup command to `npm run link` and update documentation.
5. Verify the old layout is no longer referenced.

Rollback: restore the previous `opencode/` layout, revert the manifest, and point the script back to the OpenCode-specific installer.

## Open Questions

- None. The change scope is intentionally small and the remaining implementation details are straightforward.
