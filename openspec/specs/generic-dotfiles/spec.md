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

#### Scenario: Track quota-toast sidecar directory

- **WHEN** the manifest contains an entry with `source`: `dotfiles/opencode/opencode-quota/` and `target`: `~/.config/opencode/opencode-quota/`
- **THEN** the installer creates a directory symlink at the resolved target path

#### Scenario: Sidecar config is readable after linking

- **WHEN** the installer has linked the sidecar directory
- **THEN** the plugin config file at `quota-toast.json` is readable at the symlinked target

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

The system SHALL replace existing files, directories, or symlinks at the target path and create missing parent directories, but only after the target has passed safety validation. When preparing parent directories, the system SHALL preserve unmanaged ancestor symlinks and SHALL only replace an immediate parent symlink when it resolves inside the repository.

#### Scenario: Replace an existing file at a safe target

- **WHEN** a safe target path already contains a regular file
- **THEN** the installer replaces it with the requested symlink

#### Scenario: Create missing parent directories for a safe target

- **WHEN** a safe target path has missing parent directories
- **THEN** the installer creates them before linking

#### Scenario: Preserve unmanaged ancestor symlink while linking safe target

- **WHEN** a safe target path is under a symlinked ancestor directory that is not the immediate parent
- **THEN** the installer preserves that ancestor symlink before linking

#### Scenario: Replace repo-backed immediate parent symlink before linking safe target

- **WHEN** the immediate parent of a safe target path is a symlink that resolves inside the repository
- **THEN** the installer replaces that parent with a real directory before linking

### Requirement: Installation fails fast on invalid input

The system SHALL stop at the first invalid manifest entry or linking error and report the failure.

#### Scenario: Stop on invalid entry

- **WHEN** the manifest contains an entry missing `source` or `target`
- **THEN** the installer fails without processing later entries

### Requirement: Default manifest uses mirrored Pi source paths

The shipped root `dotfiles.json` manifest SHALL reference Pi source paths that match the managed repository layout under `dotfiles/pi` while preserving the same destination targets under `~/.pi`.

#### Scenario: Read Pi entries from the default manifest

- **WHEN** the repository root `dotfiles.json` file is read
- **THEN** each Pi entry targeting `~/.pi/*` uses a source path under `dotfiles/pi` with the corresponding managed relative path
- **AND** Pi entries targeting `~/.pi/agent/prompts` and `~/.pi/agent/extensions` use source paths under `dotfiles/pi/agent/prompts` and `dotfiles/pi/agent/extensions`
