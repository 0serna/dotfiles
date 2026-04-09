## Context

The current generic dotfiles installer trusts `target` after expanding `~`, then removes the destination recursively before creating the symlink. That makes `~`, `~/`, and any target inside the repository unsafe.

## Goals / Non-Goals

**Goals:**
- Prevent recursive deletion of the home directory root.
- Prevent recursive deletion of repository contents through a malicious `target`.
- Keep normal dotfiles targets such as `~/.config/...` working.

**Non-Goals:**
- Changing the manifest format.
- Adding interactive confirmation prompts.
- Restricting targets to a single directory prefix beyond the minimum safety checks.

## Decisions

### 1. Validate target safety before removal
Resolve `target`, then reject it if it equals the home directory root or falls inside the repository tree.

Rationale: the dangerous behavior happens at deletion time, so validation must happen before any filesystem mutation.

Alternatives considered:
- Checking only after `fs.rm`. Rejected because the damage would already be done.
- Restricting all targets to a fixed prefix. Rejected because it is stricter than needed for the current use case.

### 2. Keep `~/.config/...` working
Allow targets under the home directory, but not the home directory root itself.

Rationale: this preserves the common dotfiles layout while removing the destructive edge case.

Alternatives considered:
- Rejecting all `~`-based targets. Rejected because it breaks the current workflow.

### 3. Fail fast on invalid targets
Treat unsafe targets as hard errors and stop processing later entries.

Rationale: a manifest with one dangerous entry should not partially apply anything else.

Alternatives considered:
- Skipping only invalid entries. Rejected because it can hide a dangerous manifest during setup.

## Risks / Trade-offs

- [A legitimate target may be rejected if path normalization is wrong] → Normalize paths consistently before comparison and test `~`, `~/`, and repository-relative collisions.
- [Edge cases around symlinks in the repo] → Compare resolved paths, not raw strings.
- [Some users may want to target unusual system locations] → Keep the safety check minimal and document the rule clearly.

## Migration Plan

1. Add target validation tests covering home root and repository-internal targets.
2. Update the installer to reject unsafe targets before `fs.rm`.
3. Verify existing dotfiles paths like `~/.config/opencode` still work.

Rollback: restore the previous target resolution logic if the safety checks break legitimate dotfiles paths.

## Open Questions

- Should targets also be blocked outside the home directory by policy, or is home-root and repo-internal validation enough for now?
