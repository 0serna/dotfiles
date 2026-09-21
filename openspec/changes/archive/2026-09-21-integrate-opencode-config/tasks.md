# Tasks

## 1. Decisiones base y archivos versionados

- [x] 1.1 Fijar `model` por defecto en formato `provider/model` y registrarlo en el ADR, verificar que `opencode api get /api/info` o docs V2 lo reconocen como válido
- [x] 1.2 Crear `dotfiles/opencode/opencode.jsonc` con `$schema`, `model`, `formatter:true` y `permissions` base, verificar con `python3 -m json.tool` o parse JSONC y `npm run check`
- [x] 1.3 Crear `dotfiles/opencode/cli.json` con `$schema V2`, tema y `session.permissions:prompt`, verificar que el TUI arranca sin errores de `unknown settings`
- [x] 1.4 Crear ADR `docs/adr/XXXX-opencode-config-layout.md` con layout por archivo y alternativas rechazadas, verificar que el archivo existe y se referencia desde el change

## 2. Manifiesto y enlace

- [x] 2.1 Añadir 2 entradas en `dotfiles.json` para `opencode.jsonc` y `cli.json` a `~/.config/opencode/`, verificar con `npm run check` y lectura del manifiesto
- [x] 2.2 Ejecutar backup manual de `~/.config/opencode/opencode.jsonc` a `/tmp/` y luego `npm run link`, verificar con `ls -l ~/.config/opencode/*.jsonc` que ambos son symlinks al repo
- [x] 2.3 Verificar que `auth.json` y `service.json` siguen como archivos reales tras el enlace, verificar con `ls -l ~/.config/opencode/` y contenido intacto

## 3. Verificación y docs

- [x] 3.1 Ejecutar `npm test`, `npm run check` y `npm run typecheck`, verificar que los tres pasan sin errores
- [x] 3.2 Smoke test manual de OpenCode (arranque TUI y `opencode mcp list`), verificar carga sin errores de parse ni permisos inesperados
- [x] 3.3 Actualizar `README.md` y `AGENTS.md` con el área `dotfiles/opencode/` si aplica, verificar con `git status` que solo cambian archivos esperados
