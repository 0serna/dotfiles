# Spec Delta

## Purpose

Make Pi's global settings and shared agent instructions restorable through the dotfiles manifest without taking ownership of local credentials, runtime data, or Orca-managed extensions.

## ADDED Requirements

### Requirement: Global settings are versioned and linked

The repository SHALL version the current Pi global settings in `dotfiles/pi/settings.json`, preserving every field and value from the configuration adopted during implementation, including `deviceId` and `lastChangelogVersion`. Running `npm run link` SHALL create a file-level symlink from `~/.pi/agent/settings.json` to that repository file.

#### Scenario: Existing settings are adopted without filtering

- **WHEN** the existing global settings are adopted into the repository
- **THEN** the repository file is valid JSON with the same fields and values, including provider, model, project-trust policy, device identity, and changelog version

#### Scenario: Fresh installation links settings

- **WHEN** the user runs `npm run link` and the Pi settings target does not exist
- **THEN** `~/.pi/agent/settings.json` is a symlink resolving to `dotfiles/pi/settings.json`

#### Scenario: Existing settings are replaced idempotently

- **WHEN** the Pi settings target is a regular file and the user runs `npm run link` twice
- **THEN** both runs succeed and the target resolves to the managed settings file after each run

### Requirement: Pi uses the shared global instructions

The system SHALL link `dotfiles/AGENTS.md` to `~/.pi/agent/AGENTS.md` through `dotfiles.json`. It SHALL retain the existing OpenCode and Codex instruction links to the same source and SHALL NOT create a separate Pi instruction copy.

#### Scenario: Shared instructions are available to every configured agent

- **WHEN** the user runs `npm run link`
- **THEN** the Pi, OpenCode, and Codex global `AGENTS.md` targets resolve to `dotfiles/AGENTS.md` and expose the same contents

### Requirement: Pi runtime data and Orca extensions remain unmanaged

The system SHALL NOT link `~/.pi/agent` or `~/.pi/agent/extensions` as whole directories. Linking Pi's managed files SHALL preserve existing unmanaged files and directories, including credentials, model cache, trust decisions, sessions, binaries, installation data, and Orca-managed extensions. The repository SHALL exclude `orca-*` entries under `dotfiles/pi/extensions/` from normal Git tracking and SHALL NOT declare manifest targets for Orca-managed extensions.

#### Scenario: Unmanaged data survives installation and reinstallation

- **WHEN** Pi's agent directory contains `auth.json`, `models-store.json`, `trust.json`, files under `sessions/`, `bin/`, and `install/`, and the three existing `extensions/orca-*.ts` files before two runs of `npm run link`
- **THEN** all those files retain their contents and the agent and extensions directories remain real directories

#### Scenario: Orca-managed extension copies are ignored

- **WHEN** Git evaluates an `orca-*` entry under `dotfiles/pi/extensions/`
- **THEN** an ignore rule excludes that entry from normal tracking and the manifest contains no Orca extension target

### Requirement: Personal extensions have an isolated repository location

The repository SHALL provide `dotfiles/pi/extensions/` for future personal extensions without installing any extension in this initial integration. A future personal extension SHALL use its own explicit file-level manifest link to the corresponding path under `~/.pi/agent/extensions/`, never a link for the shared extensions directory.

#### Scenario: Initial integration does not install a placeholder extension

- **WHEN** the initial Pi integration is installed
- **THEN** no executable extension or extension placeholder target is added under `~/.pi/agent/extensions/`

#### Scenario: An individual extension can coexist with Orca extensions

- **WHEN** a manifest declares a personal extension file and linking runs with an Orca-managed extension already installed
- **THEN** the personal extension target resolves to its repository file while the Orca-managed file retains its contents and the shared extensions directory remains a real directory

### Requirement: Shared skills require no Pi-specific duplication

The Pi integration SHALL keep the existing shared-skill setup under `~/.agents/skills/` unchanged. It SHALL NOT add a Pi-specific skills directory, skills link, or skills resource-path setting.

#### Scenario: The basic integration retains the existing skills setup

- **WHEN** the Pi integration is added to the default manifest and repository
- **THEN** the existing `dotfiles/agents` to `~/.agents` link remains, no Pi skills link or directory is introduced, and no skills resource path is added to the adopted settings
