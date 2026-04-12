## Purpose

Define the repository-wide manifest and safety rules for linking dotfiles into the user environment.

## Requirements

### Requirement: Manifest-driven dotfile linking
The system SHALL read a root `dotfiles.json` manifest and create symlinks for each declared entry.

#### Scenario: Link declared entries
- **WHEN** the installer runs with a valid `dotfiles.json`
- **THEN** it creates symlinks for every entry in the manifest

#### Scenario: Include the repo-backed agent home directory
- **WHEN** the repository manifest is read after tracking global agent skills
- **THEN** it includes an entry mapping `dotfiles/agents` to `~/.agents`

### Requirement: Source paths stay within the repository
The system SHALL resolve each `source` relative to the repository root and reject any source that escapes the repository.

#### Scenario: Resolve a valid source path
- **WHEN** an entry sets `source` to `dotfiles/opencode/opencode.jsonc`
- **THEN** the installer uses that path within the repository

#### Scenario: Reject path traversal in source
- **WHEN** an entry sets `source` to `../secret.txt`
- **THEN** the installer rejects the entry before linking

### Requirement: Targets resolve to system paths
The system SHALL resolve each `target` as an absolute filesystem path, support `~` expansion, and reject targets that resolve to the home directory root or inside the repository.

#### Scenario: Expand home shorthand
- **WHEN** an entry sets `target` to `~/.config/opencode/opencode.jsonc`
- **THEN** the installer resolves it under the current user's home directory

#### Scenario: Reject home root target
- **WHEN** an entry sets `target` to `~` or `~/`
- **THEN** the installer rejects the entry before any filesystem removal

#### Scenario: Reject repository target
- **WHEN** an entry sets `target` to a path that resolves inside the repository
- **THEN** the installer rejects the entry before any filesystem removal

### Requirement: Existing targets are replaced safely
The system SHALL replace existing files, directories, or symlinks at the target path and create missing parent directories, but only after the target has passed safety validation.

#### Scenario: Replace an existing file at a safe target
- **WHEN** a safe target path already contains a regular file
- **THEN** the installer replaces it with the requested symlink

#### Scenario: Create missing parent directories for a safe target
- **WHEN** a safe target path has missing parent directories
- **THEN** the installer creates them before linking

### Requirement: Installation fails fast on invalid input
The system SHALL stop at the first invalid manifest entry or linking error and report the failure.

#### Scenario: Stop on invalid entry
- **WHEN** the manifest contains an entry missing `source` or `target`
- **THEN** the installer fails without processing later entries
