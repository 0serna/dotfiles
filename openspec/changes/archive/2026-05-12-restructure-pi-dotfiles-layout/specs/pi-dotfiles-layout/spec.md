## ADDED Requirements

### Requirement: Repository mirrors the shareable Pi configuration layout

The repository SHALL store managed Pi configuration under `dotfiles/pi` using the same path structure as the shareable subset of `~/.pi`.

#### Scenario: Inspect the managed Pi root layout

- **WHEN** the repository-managed Pi files are inspected
- **THEN** files destined for `~/.pi/*` appear at matching relative paths under `dotfiles/pi`
- **AND** files destined for `~/.pi/agent/*` appear at matching relative paths under `dotfiles/pi/agent`

### Requirement: Managed Pi layout excludes runtime state

The repository SHALL limit `dotfiles/pi` to shareable Pi configuration and SHALL NOT represent runtime or machine-local Pi state.

#### Scenario: Review excluded Pi runtime paths

- **WHEN** the managed Pi layout is compared against the full `~/.pi` tree
- **THEN** runtime-only paths such as agent authentication state, session history, and generated binaries are not treated as repository-managed dotfiles

### Requirement: Prompt and extension sources live under the managed agent subtree

The repository SHALL store Pi prompt templates and Pi extensions under `dotfiles/pi/agent` because their destination paths are under `~/.pi/agent`.

#### Scenario: Inspect prompt and extension source directories

- **WHEN** the repository-managed Pi source tree is inspected
- **THEN** prompt templates are stored under `dotfiles/pi/agent/prompts`
- **AND** extensions are stored under `dotfiles/pi/agent/extensions`
