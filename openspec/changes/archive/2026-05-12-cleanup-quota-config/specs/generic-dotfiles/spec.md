## ADDED Requirements

### Requirement: Plugin sidecar config directories are tracked

The dotfiles manifest SHALL support entries for plugin-specific config directories that live alongside the main application config.

#### Scenario: Track quota-toast sidecar directory

- **WHEN** the manifest contains an entry with `source`: `dotfiles/opencode/opencode-quota/` and `target`: `~/.config/opencode/opencode-quota/`
- **THEN** the installer creates a directory symlink at the resolved target path

#### Scenario: Sidecar config is readable after linking

- **WHEN** the installer has linked the sidecar directory
- **THEN** the plugin config file at `quota-toast.json` is readable at the symlinked target
