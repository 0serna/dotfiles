# skill-invocation Specification

## Purpose

Garantizar que una skill marcada solo-humana se oculte del modelo en todos los proveedores soportados, con `disable-model-invocation: true` como única decisión manual y derivados por proveedor generados por `npm run skills:update`.

## Requirements

### Requirement: Flag solo-humano deriva a frontmatter OpenCode

The system SHALL ensure every `SKILL.md` under `dotfiles/agents/skills/` whose frontmatter contains `disable-model-invocation: true` also declares `metadata.opencode/autoinvoke: false` as boolean `false`, merging with any existing `metadata` block instead of replacing it.

#### Scenario: Skill marcada sin bloque metadata recibe el derivado

- **WHEN** `npm run skills:update` processes a flagged `SKILL.md` with no `metadata` block
- **THEN** its frontmatter gains `metadata:` with `opencode/autoinvoke: false` and all prior keys keep their values and order

#### Scenario: Metadata existente con claves ajenas se preserva

- **WHEN** a flagged `SKILL.md` already has `metadata` with unrelated keys (e.g. `author`, `version`, `generatedBy`)
- **THEN** after normalization those keys remain unchanged and `opencode/autoinvoke: false` is present alongside them

#### Scenario: Valor incorrecto se corrige

- **WHEN** a flagged `SKILL.md` declares `opencode/autoinvoke` as `true` or `"true"`
- **THEN** normalization rewrites it to boolean `false`

#### Scenario: Skill no marcada queda intacta

- **WHEN** a `SKILL.md` lacks `disable-model-invocation: true`
- **THEN** normalization does not add, remove, or modify any `opencode/autoinvoke` entry in it

#### Scenario: Normalización es idempotente

- **WHEN** `normalizeSkills` runs twice over an already aligned skills directory
- **THEN** the second run reports zero changes and file contents are byte-identical

### Requirement: Derivación OpenAI existente se preserva

The system SHALL continue to ensure every flagged skill has `agents/openai.yaml` with `policy.allow_implicit_invocation: false`, preserving any other existing keys in that file.

#### Scenario: Derivado OpenAI intacto tras el cambio

- **WHEN** `npm run skills:update` runs over a flagged skill
- **THEN** its `agents/openai.yaml` contains `policy:` with `allow_implicit_invocation: false` and pre-existing keys such as `interface.display_name` are preserved

### Requirement: Descripción y visibilidad slash se preservan

The system SHALL NOT remove `description` from flagged skills and SHALL NOT set `slash: false` nor `metadata.opencode/slash: false` during normalization.

#### Scenario: Skill solo-humana sigue visible al humano

- **WHEN** normalization processes a flagged skill that has a `description`
- **THEN** the `description` remains present and no `slash: false` or `metadata.opencode/slash: false` entry is introduced
