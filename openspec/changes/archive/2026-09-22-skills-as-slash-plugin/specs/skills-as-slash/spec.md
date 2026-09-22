# skills-as-slash Specification

## Purpose

Mirror every installed skill with a `description` as an in-memory `/skill:<id>` slash command that loads the skill through the native attachment path, with no generated files.

## ADDED Requirements

### Requirement: Skills with description are mirrored as slash commands

The system SHALL register one command named `skill:<id>` for every skill returned by the skill registry that has a `description`, using the skill's `description` as the command description.

#### Scenario: Described skill appears in command registry

- **WHEN** the plugin loads with a skill `commit-and-push` that has a `description`
- **THEN** the command registry contains `skill:commit-and-push` with that description

#### Scenario: Skill without description is skipped

- **WHEN** a skill has no `description`
- **THEN** no `skill:<id>` command is registered for it

### Requirement: Executing a mirrored command loads the skill natively

The system SHALL submit the invocation by re-sending the user's text with the skill attached by ID (`skills: [{id}]`), preserving the invocation's delivery mode, instead of pasting skill content into the prompt.

#### Scenario: Slash invocation attaches skill and forwards arguments

- **WHEN** the user invokes `/skill:commit-and-push push to origin` in the current session
- **THEN** the session receives a prompt with text `push to origin`, skill `commit-and-push` attached, and the original delivery mode

#### Scenario: Human-only skill loads despite model hiding

- **WHEN** the mirrored skill sets `autoinvoke: false`
- **THEN** invoking its `/skill:<id>` command still attaches and loads the skill by explicit ID

### Requirement: Mirror follows skill registry changes without restart

The system SHALL re-register the mirrored command set when the skill registry reports an update, disposing removed mirrors and adding new ones, without modifying any files.

#### Scenario: New skill appears after install

- **WHEN** a new described skill is installed while the service runs
- **THEN** its `/skill:<id>` command becomes available without restarting the service or editing configuration

#### Scenario: Removed skill disappears from registry

- **WHEN** a skill is removed from the registry
- **THEN** its `/skill:<id>` command is withdrawn without affecting unrelated commands
