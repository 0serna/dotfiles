# Design

## Context

Ver `proposal.md` (Why). Estado actual: `src/skills/skills-update.ts:normalizeSkills` detecta `disable-model-invocation: true` con regex sobre el frontmatter de `SKILL.md` y deriva un sidecar `agents/openai.yaml` (`policy.allow_implicit_invocation: false`). OpenCode no lee ninguna de esas dos señales: descubre skills vía `~/.agents/skills` (enlace de `dotfiles/agents`) y solo respeta `description` ausente o `metadata.opencode/autoinvoke: false` en el propio `SKILL.md`. Las skills generadas `openspec-*` ya traen bloque `metadata` (`author/version/generatedBy`), por lo que la fusión es obligatoria. Decisión de alcance ya confirmada: solo `autoinvoke:false`, `slash` queda visible.

## Goals / Non-Goals

**Goals:**

- Una sola decisión manual (`disable-model-invocation: true`); OpenAI y OpenCode como derivados generados e idempotentes.
- Fusión in-place del frontmatter que preserve orden, comentarios y claves ajenas.

**Non-Goals:**

- Cambiar la semántica de `SKILL-MECHANICS.md` (quién debe ser user-invoked); solo se añade el derivado.
- Gestionar permisos `skill` por agente en `opencode.jsonc` ni catálogos HTTP.
- Migrar el parser de frontmatter a una dependencia YAML salvo que los tests demuestren que el merge mínimo no basta.

## Decisions

- **Fuente única `disable-model-invocation: true`, derivados generados.** Alternativa: editar `autoinvoke` a mano por skill. Rechazada: doble fuente diverge; el patrón existente ya deriva OpenAI así.
- **Merge mínimo del bloque `metadata` en `SKILL.md`, sin reescribir todo el frontmatter.** Alternativa: re-serializar el frontmatter con librería YAML. Rechazada como primer paso: reordena claves y destruye comentarios; solo se adopta si los casos `metadata` multilínea + `opencode/` con comillado lo exigen. El merge debe tratar `opencode/autoinvoke` como clave literal con `/` (comillada si el estilo del archivo lo requiere) y aceptar corrección desde `true`/`"true"` a boolean `false`.
- **Mantener `description`, no tocar `slash`.** `autoinvoke:false` + `description` presente = oculta al modelo, visible y cargable por el humano, que es la semántica actual de user-invoked y del router skill. `slash:false` las haría invisibles también al humano.
- **Orden `sync` luego `normalize` (el actual en `main()`).** `syncOpenSpecSkills` reemplaza directorios `openspec-*`; normalizar después garantiza que cualquier regenerado con flag quede alineado en la misma corrida.

## Risks / Trade-offs

- [Riesgo] Regex actual frágil ante `metadata` anidada/multilínea → Mitigación: función de merge acotada al bloque `metadata` + casos de test (sin bloque, con claves ajenas, valor `true`, ya correcto, sin flag).
- [Riesgo] Clave con `/` rompe parsers YAML ingenuos o produce doble comillado → Mitigación: test de round-trip sobre un fixture copiado de `openspec-propose/SKILL.md:7-10`.
- [Riesgo] Reescritura masiva de `SKILL.md` genera diff ruidoso → Mitigación: reescribir solo archivos que cambian; segunda pasada reporta `0` (idempotencia cubierta por test).
- [Trade-off] Merge textual conserva formato pero es más código que re-serializar; se acepta para no destruir frontmatter existente.

## Migration Plan

1. Implementar y testear (`npm run test`, `npm run check`, `npm run typecheck`).
2. Ejecutar `npm run skills:update`; revisar `git diff` de `SKILL.md` afectados (solo añadido/fusión de `opencode/autoinvoke: false`).
3. Sin rollback especial: revertir el commit del normalizador + frontmatter regenerado.
