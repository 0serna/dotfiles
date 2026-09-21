# Proposal

## Why

La configuración global de OpenCode (`opencode.jsonc` y `cli.json`) hoy vive fuera del repo: `opencode.jsonc` es un archivo real con solo `$schema` y `cli.json` ni existe. Sin versionarla en dotfiles se pierde reproducibilidad entre máquinas y el `npm run link` no restaura el entorno del agente.

## What Changes

- Añade `dotfiles/opencode/opencode.jsonc` como configuración global base (server + proyectos) con `$schema`, `model`, `formatter` y permisos mínimos.
- Añade `dotfiles/opencode/cli.json` como configuración solo-TUI (tema, sesión, tabs) con `$schema` V2.
- Registra ambas entradas en `dotfiles.json` con enlace por archivo a `~/.config/opencode/`.
- Reutiliza `src/installer` sin cambios de código: enlaces tipo `file` con `rm + symlink`, sin enlazar el directorio completo para no clobber `auth.json` ni logs.
- Documenta en `README.md` / `AGENTS.md` la nueva área `dotfiles/opencode/` si el layout cambia.

## Capabilities

### New Capabilities

- `opencode-config`: gestión versionada de la configuración global básica de OpenCode (`opencode.jsonc` + `cli.json`) vía manifiesto y `npm run link`.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío y no se modifica comportamiento existente.

## Impact

- Afectados: `dotfiles.json`, `dotfiles/opencode/*`, `~/.config/opencode/opencode.jsonc` (pasa de archivo real a symlink), `~/.config/opencode/cli.json` (nuevo symlink).
- Sin cambios en `src/installer/*.ts`: el linker ya soporta archivos; solo se añaden entradas al manifiesto.
- Riesgos: sobrescritura del `opencode.jsonc` actual al enlazar; `~/.config/opencode/` contiene `node_modules` residual que no debe versionarse; no mezclar campos server (`opencode.jsonc`) con campos TUI (`cli.json`).
- Requiere ADR de layout antes de archivar, según `dotfiles/AGENTS.md`.
