## ADDED Requirements

### Requirement: Default manifest uses mirrored Pi source paths

The shipped root `dotfiles.json` manifest SHALL reference Pi source paths that match the managed repository layout under `dotfiles/pi` while preserving the same destination targets under `~/.pi`.

#### Scenario: Read Pi entries from the default manifest

- **WHEN** the repository root `dotfiles.json` file is read
- **THEN** each Pi entry targeting `~/.pi/*` uses a source path under `dotfiles/pi` with the corresponding managed relative path
- **AND** Pi entries targeting `~/.pi/agent/prompts` and `~/.pi/agent/extensions` use source paths under `dotfiles/pi/agent/prompts` and `dotfiles/pi/agent/extensions`
