# opencode-config Specification

## Purpose

Extend versioned global OpenCode configuration with the managed plugins directory that carries the skills-as-slash plugin.

## ADDED Requirements

### Requirement: Global plugins directory is versioned via manifest

The system SHALL manage `dotfiles/opencode/plugins/` as the single source for `~/.config/opencode/plugins/` through `dotfiles.json` using a directory-level link, and SHALL still never link `~/.config/opencode/` itself.

#### Scenario: Fresh link creates plugins symlink

- **WHEN** the user runs `npm run link` with the manifest entry present and no target exists
- **THEN** `~/.config/opencode/plugins` is a symlink resolving into `dotfiles/opencode/plugins`

#### Scenario: Unmanaged siblings survive linking

- **WHEN** `~/.config/opencode/auth.json` exists before `npm run link`
- **THEN** after linking, `auth.json` still exists as a real file with unchanged content
