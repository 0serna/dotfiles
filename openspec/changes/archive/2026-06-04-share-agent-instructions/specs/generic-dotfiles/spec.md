## MODIFIED Requirements

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

#### Scenario: Link shared agent instructions to multiple targets

- **WHEN** the manifest contains multiple entries with `source`: `dotfiles/AGENTS.md`
- **THEN** the installer creates a symlink for each declared target pointing at the same source file

### Requirement: Default manifest uses mirrored Pi source paths

The shipped root `dotfiles.json` manifest SHALL reference Pi source paths that match the managed repository layout under `dotfiles/pi` while preserving the same destination targets under `~/.pi`, except shared agent instructions SHALL use `dotfiles/AGENTS.md` as their canonical source.

#### Scenario: Read Pi entries from the default manifest

- **WHEN** the repository root `dotfiles.json` file is read
- **THEN** each Pi entry targeting `~/.pi/*` uses a source path under `dotfiles/pi` with the corresponding managed relative path, except the entry targeting `~/.pi/agent/AGENTS.md`
- **AND** Pi entries targeting `~/.pi/agent/prompts` and `~/.pi/agent/extensions` use source paths under `dotfiles/pi/agent/prompts` and `dotfiles/pi/agent/extensions`
- **AND** the Pi entry targeting `~/.pi/agent/AGENTS.md` uses `dotfiles/AGENTS.md` as its source

#### Scenario: Read shared agent instruction entries from the default manifest

- **WHEN** the repository root `dotfiles.json` file is read
- **THEN** the entries targeting `~/.pi/agent/AGENTS.md` and `~/.config/opencode/AGENTS.md` both use `dotfiles/AGENTS.md` as their source
