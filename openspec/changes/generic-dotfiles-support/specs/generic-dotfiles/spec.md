## ADDED Requirements

### Requirement: Manifest-driven dotfile linking
The system SHALL read a root `dotfiles.json` manifest and create symlinks for each declared entry.

#### Scenario: Link declared entries
- **WHEN** the installer runs with a valid `dotfiles.json`
- **THEN** it creates symlinks for every entry in the manifest

### Requirement: Source paths stay within the repository
The system SHALL resolve each `source` relative to the repository root and reject any source that escapes the repository.

#### Scenario: Resolve a valid source path
- **WHEN** an entry sets `source` to `dotfiles/opencode/opencode.jsonc`
- **THEN** the installer uses that path within the repository

#### Scenario: Reject path traversal in source
- **WHEN** an entry sets `source` to `../secret.txt`
- **THEN** the installer rejects the entry before linking

### Requirement: Targets resolve to system paths
The system SHALL resolve each `target` as an absolute filesystem path and support `~` expansion.

#### Scenario: Expand home shorthand
- **WHEN** an entry sets `target` to `~/.config/opencode/opencode.jsonc`
- **THEN** the installer resolves it under the current user's home directory

### Requirement: Existing targets are replaced safely
The system SHALL replace existing files, directories, or symlinks at the target path and create missing parent directories.

#### Scenario: Replace an existing file
- **WHEN** a target path already contains a regular file
- **THEN** the installer replaces it with the requested symlink

#### Scenario: Create missing parent directories
- **WHEN** the target parent directories do not exist
- **THEN** the installer creates them before linking

### Requirement: Installation fails fast on invalid input
The system SHALL stop at the first invalid manifest entry or linking error and report the failure.

#### Scenario: Stop on invalid entry
- **WHEN** the manifest contains an entry missing `source` or `target`
- **THEN** the installer fails without processing later entries
