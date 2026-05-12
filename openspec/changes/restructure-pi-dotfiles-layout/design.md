## Context

Pi configuration is currently versioned in `dotfiles/pi`, but the repository layout only partially matches the destination layout under `~/.pi`. The most visible mismatch is that prompt templates and extensions live at `dotfiles/pi/prompts` and `dotfiles/pi/extensions` while the manifest links them into `~/.pi/agent/prompts` and `~/.pi/agent/extensions`. The change needs to improve structural clarity without expanding the managed scope to runtime state such as `auth.json`, `bin/`, or `sessions/`.

## Goals / Non-Goals

**Goals:**

- Make `dotfiles/pi` mirror the shareable subset of `~/.pi`.
- Preserve the semantic boundary between `~/.pi/*` and `~/.pi/agent/*` in the repository layout.
- Keep all existing linked destination paths for Pi configuration unchanged.
- Keep runtime and machine-local Pi state out of the managed dotfiles tree.

**Non-Goals:**

- Managing all contents of `~/.pi`.
- Changing Pi behavior, settings values, prompt contents, or extension code as part of this change.
- Introducing new installer behavior beyond updating manifest paths to match the new repository layout.

## Decisions

### Mirror the managed subset of `~/.pi` directly

The repository will treat `dotfiles/pi` as a structural mirror of the versioned subset of `~/.pi`, not as an abstract source layout.

- **Why:** This makes the managed Pi footprint self-explanatory and removes the need to mentally translate from repo paths to destination paths.
- **Alternative considered:** Keep a repository-optimized layout and rely on `dotfiles.json` for translation. Rejected because it preserves the current ambiguity and makes layout drift harder to notice.

### Keep only shareable configuration in the mirror

Only declarative, shareable configuration paths will be represented in `dotfiles/pi`.

- **Why:** `~/.pi` mixes persistent configuration with machine-local runtime state. Versioning runtime files would blur ownership and create risk around secrets and transient data.
- **Alternative considered:** Mirror the full `~/.pi` tree. Rejected because runtime paths such as `auth.json`, `bin/`, and `sessions/` are intentionally local.

### Preserve root-versus-agent boundaries

Files that live in `~/.pi/` will remain at the root of `dotfiles/pi`, while files that live in `~/.pi/agent/` will live under `dotfiles/pi/agent/`.

- **Why:** This keeps the repository aligned with Pi's documented locations and makes path ownership explicit.
- **Alternative considered:** Group all versioned Pi files together under a convenience subdirectory. Rejected because it would reintroduce a translation layer inside the repo.

### Treat the change as a repository layout migration plus manifest update

Implementation will consist of moving the affected source directories and updating `dotfiles.json` entries to point at the new source paths while preserving destination targets.

- **Why:** The behavior contract is the linked destination tree, so the lowest-risk change is to migrate only repository source locations and manifest references.
- **Alternative considered:** Replace several file-level links with a higher-level directory link. Rejected because it would broaden the managed scope and could accidentally include non-shareable state in the future.

## Risks / Trade-offs

- **Repository moves can break manifest entries if a path is missed** → Update all Pi-specific `dotfiles.json` entries together and verify the manifest still points to every managed Pi file and directory.
- **A partial mirror may be mistaken for a full mirror of `~/.pi`** → Capture in spec language that only the shareable subset is mirrored and that runtime paths remain excluded.
- **Future contributors may add new Pi resources in the wrong place** → Define the repository layout expectation in a dedicated Pi capability spec so placement rules are explicit.

## Migration Plan

1. Move repository-managed Pi prompts and extensions under `dotfiles/pi/agent/`.
2. Update `dotfiles.json` source paths for the moved Pi entries.
3. Leave all Pi target paths unchanged so existing installs continue to resolve to the same locations.
4. Validate that the manifest still covers the intended shareable Pi files and excludes runtime-only paths.

Rollback consists of restoring the previous repository paths and resetting the corresponding `dotfiles.json` entries.

## Open Questions

None.
