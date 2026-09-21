# opencode-config Specification

## Purpose

Versionar la configuración global básica de OpenCode para restaurar el entorno del agente con `npm run link` de forma reproducible.

## Requirements

### Requirement: Global server config is versioned via manifest

The system SHALL manage `dotfiles/opencode/opencode.jsonc` as the single source for `~/.config/opencode/opencode.jsonc` through `dotfiles.json` using a file-level link.

#### Scenario: Fresh link creates server config symlink

- **WHEN** the user runs `npm run link` with the manifest entry present and no target file exists
- **THEN** `~/.config/opencode/opencode.jsonc` is a symlink resolving into `dotfiles/opencode/opencode.jsonc`

#### Scenario: Existing real file is replaced idempotently

- **WHEN** `~/.config/opencode/opencode.jsonc` exists as a real file with only `$schema`
- **THEN** running `npm run link` replaces it with the managed symlink without failing the install

### Requirement: CLI-only config is versioned via manifest

The system SHALL manage `dotfiles/opencode/cli.json` as the single source for `~/.config/opencode/cli.json` through `dotfiles.json` using a file-level link and SHALL NOT mix server fields into it.

#### Scenario: Fresh link creates CLI symlink

- **WHEN** the user runs `npm run link` with the manifest entry present
- **THEN** `~/.config/opencode/cli.json` is a symlink resolving into `dotfiles/opencode/cli.json`

#### Scenario: CLI file validates against V2 schema

- **WHEN** OpenCode TUI starts with the linked `cli.json`
- **THEN** no unknown-settings error is reported and the file contains `$schema: https://opencode.ai/v2/cli.json`

### Requirement: Config directory is never clobbered

The system SHALL link individual files under `~/.config/opencode/` and SHALL NOT link the directory itself, preserving unmanaged files such as `auth.json`, `service.json`, and logs.

#### Scenario: Unmanaged files survive linking

- **WHEN** `~/.config/opencode/auth.json` exists before `npm run link`
- **THEN** after linking both managed files, `auth.json` still exists as a real file with unchanged content

### Requirement: Base configs are valid and minimal

Both managed files SHALL be valid JSONC parseable by OpenCode, SHALL include their `$schema` for editor validation, and SHALL pass `npm run check` and `npm run typecheck` gates where applicable.

#### Scenario: Biome and parse validation

- **WHEN** CI runs `npm run check` and OpenCode loads the linked configs
- **THEN** Biome reports no errors for the new JSONC files and OpenCode loads both without parse errors

#### Scenario: Minimal base content is present

- **WHEN** reading the linked `opencode.jsonc`
- **THEN** it defines at least `$schema`, a default `model` in `provider/model` format, and `formatter` enabled, and `cli.json` defines at least `$schema` plus TUI appearance/session defaults
