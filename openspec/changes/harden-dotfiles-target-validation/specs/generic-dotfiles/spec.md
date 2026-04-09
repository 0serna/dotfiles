## MODIFIED Requirements

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
