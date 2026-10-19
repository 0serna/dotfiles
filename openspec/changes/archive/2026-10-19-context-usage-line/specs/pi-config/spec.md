# Spec Delta

## MODIFIED Requirements

### Requirement: Personal extensions have an isolated repository location

The repository SHALL provide `dotfiles/pi/extensions/` for personal extensions. Each personal extension SHALL use its own explicit file-level manifest link to the corresponding path under `~/.pi/agent/extensions/`, never a link for the shared extensions directory.

#### Scenario: Declared extensions are linked on fresh installation

- **WHEN** the user runs `npm run link` and the manifest declares `dotfiles/pi/extensions/context-report.ts`
- **THEN** `~/.pi/agent/extensions/context-report.ts` resolves to the repository file and no undeclared extension is installed

#### Scenario: Initial integration does not install a placeholder extension

- **WHEN** the Pi integration is installed
- **THEN** no placeholder extension target is added under `~/.pi/agent/extensions/`, and every extension target comes from an explicit manifest entry

#### Scenario: An individual extension can coexist with Orca extensions

- **WHEN** a manifest declares a personal extension file and linking runs with an Orca-managed extension already installed
- **THEN** the personal extension target resolves to its repository file while the Orca-managed file retains its contents and the shared extensions directory remains a real directory
