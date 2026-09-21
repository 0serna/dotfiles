# Design

## Context

Ver `proposal.md - Why`. Estado actual: `dotfiles.json` enlaza `dotfiles/AGENTS.md -> ~/.config/opencode/AGENTS.md` y `dotfiles/agents -> ~/.agents`; `~/.config/opencode/opencode.jsonc` es archivo real mínimo y `cli.json` no existe. El linker (`src/installer/linker.ts`) ya soporta enlaces `file` con `rm + symlink` y manejo de padres repo-backed. Restricción: no enlazar directorios completos bajo `~/.config/opencode/`.

## Goals / Non-Goals

**Goals:**

- Versionar `opencode.jsonc` global y `cli.json` bajo `dotfiles/opencode/` con entradas de manifiesto por archivo.
- Migración idempotente del `opencode.jsonc` real actual a symlink sin romper `auth.json` ni logs.
- Base mínima válida V2 separando campos server vs TUI.

**Non-Goals:**

- No gestionar configuración por proyecto (`<repo>/opencode.jsonc` o `.opencode/`).
- No definir MCP servers, plugins, ni policies remotas en esta base.
- No cambiar código de `src/installer/` salvo que un test lo exija.
- No versionar secretos (`auth.json`, API keys, `{env:*}` resueltos).

## Decisions

- **Layout `dotfiles/opencode/opencode.jsonc` + `dotfiles/opencode/cli.json`.**
  Rationale: agrupa por herramienta como `dotfiles/systemd/`, evita colisión con `dotfiles/AGENTS.md` plano y deja sitio para futuros `commands/` o `skills/`.
  Alternativa rechazada: archivos planos `dotfiles/opencode.jsonc` — ensucia raíz de `dotfiles/` y no escala.

- **Enlace por archivo, no por directorio.**
  Rationale: `linker.ts:25` hace `rm -rf` del target; enlazar `~/.config/opencode` borraría `auth.json`/`service.json`. El manifiesto ya usa granularidad por archivo para `AGENTS.md` y el test `replaces an existing parent symlink` cubre la migración de padre a hijos.
  Alternativa rechazada: `dotfiles/opencode -> ~/.config/opencode` como `dir`.

- **Contenido base opinado mínimo.**
  `opencode.jsonc`: `$schema`, `formatter: true`, `permissions` con `allow` total (`action: *`, `resource: *`, sin `model` por defecto para respetar el contenido actual).
  `cli.json`: `$schema V2`, `session.permissions: autoaccept`, `session.sidebar: hide`, `tabs.enabled: false`.
  Alternativa rechazada: solo `$schema` vacío — no aporta valor y deja cada máquina a la deriva.

- **Sin cambios de linker; solo manifiesto + archivos + docs.**
  Rationale: `manifest.ts`/`paths.ts` ya validan `source` relativo dentro del repo y `target ~/...` absoluto; añadir 2 entradas es suficiente. Tests existentes (`replaces existing targets`, `creates parent directories`) cubren el caso.

## Risks / Trade-offs

- [Riesgo] `npm run link` sobrescribe el `opencode.jsonc` real actual → Mitigación: documentar en `tasks.md` backup manual previo y verificar con `ls -l ~/.config/opencode/` antes/después.
- [Riesgo] `~/.config/opencode/node_modules` residual contamina diffs o backups → Mitigación: no versionarlo, recomendar limpieza manual, añadir a `.gitignore` si aplica (fuera de este change si toca raíz).
- [Riesgo] Confusión schema V1 (`opencode.ai/config.json`) vs docs V2 → Mitigación: usar docs `v2/docs/config` y `v2/docs/cli/config` como verdad, mantener `$schema` solo para autocomplete.
- [Trade-off] `model` por defecto fija proveedor; si el usuario cambia de proveedor hay que editar versionado → Aceptado: la base es opinada y el cambio es un commit.

## Migration Plan

1. Crear `dotfiles/opencode/*.jsonc|json` y 2 entradas en `dotfiles.json`.
2. Backup local: `cp ~/.config/opencode/opencode.jsonc /tmp/opencode.jsonc.bak` (manual, no versionado).
3. `npm run link`, verificar `ls -l ~/.config/opencode/*.jsonc` son symlinks al repo y `auth.json` intacto.
4. `npm run check`, `npm run typecheck`, `npm test`; `opencode mcp list` / arranque TUI como smoke test manual.
5. Rollback: `rm` symlinks y restaurar `.bak`; `git revert` del change si ya se archivó.

## Open Questions

- ¿Qué `model` por defecto (`provider/model`) fijamos? No cambia specs ni tareas, se resuelve al implementar.
- ¿Tema TUI inicial y `tabs.scope: cwd vs global`? Deferrable al contenido de `cli.json`.
