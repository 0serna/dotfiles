# safe-parent-directory-migration Specification

## Purpose

TBD - created by archiving change prevent-ancestor-symlink-removal. Update Purpose after archive.

## Requirements

### Requirement: Preserve unmanaged ancestor symlinks

The installer SHALL NOT remove or replace symlinks in ancestor directories above the immediate parent directory of the target path.

#### Scenario: Ancestor config directory is symlinked

- **WHEN** a manifest target resolves under a symlinked ancestor such as `~/.config/opencode/opencode.jsonc`
- **THEN** the installer preserves the ancestor symlink while preparing the target parent directory

### Requirement: Migrate repo-backed immediate parent symlinks

The installer SHALL replace an immediate target parent symlink only when that symlink resolves to a path inside the repository.

#### Scenario: Existing granular parent points at repository directory

- **WHEN** the immediate parent of a target path is a symlink to a repository directory
- **THEN** the installer replaces that parent symlink with a real directory before creating the declared target symlink

### Requirement: Reject unmanaged immediate parent symlinks

The installer SHALL fail without removing the immediate target parent when that parent is a symlink that does not resolve inside the repository.

#### Scenario: Existing granular parent points outside the repository

- **WHEN** the immediate parent of a target path is a symlink to a directory outside the repository
- **THEN** the installer fails without removing or replacing that symlink
