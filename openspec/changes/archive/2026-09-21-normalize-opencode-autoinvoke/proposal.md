# Proposal

## Why

Las skills marcadas `disable-model-invocation: true` son de invocación solo-humana, pero `normalizeSkills` solo deriva ese flag a `agents/openai.yaml`. OpenCode ignora ambas señales y lee `~/.agents/skills` (vía enlace `dotfiles/agents -> ~/.agents`), por lo que hoy esas skills sí se anuncian al modelo en OpenCode.

## What Changes

- Extender `normalizeSkills` (`src/skills/skills-update.ts`) para derivar `disable-model-invocation: true` también a frontmatter OpenCode: `metadata.opencode/autoinvoke: false` en cada `SKILL.md` afectado, fusionando con `metadata` existente.
- Mantener la derivación actual a `agents/openai.yaml` (`policy.allow_implicit_invocation: false`) sin cambios de comportamiento.
- Mantener `description` en las skills afectadas y dejar `slash` visible (decisión confirmada: solo `autoinvoke:false`).
- Extender `skills-update.test.ts` con fusión de metadata, idempotencia y preservación de claves ajenas.

## Capabilities

### New Capabilities

- `skill-invocation`: normalización multi-proveedor del flag de invocación solo-humana (`disable-model-invocation: true` como fuente única; derivados OpenAI y OpenCode).

### Modified Capabilities

Ninguna. `opencode-config` cubre enlace de `opencode.jsonc`/`cli.json`, no frontmatter de skills; sus requisitos no cambian.

## Impact

- Afecta `src/skills/skills-update.ts`, `src/skills/skills-update.test.ts`, frontmatter de skills bajo `dotfiles/agents/skills/` con el flag, y `SKILL-MECHANICS.md` si documenta el nuevo derivado.
- Sin cambios en `dotfiles.json`, enlaces, ni configs globales OpenCode.
