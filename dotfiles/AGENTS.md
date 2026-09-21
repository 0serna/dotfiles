## Comunicación y formato

- Usa español neutro y un lenguaje claro en los mensajes dirigidos al usuario.
- Usa inglés para código, archivos, PRs y demás, excepto cuando el idioma forme parte del comportamiento o traducciones.

## Código y herramientas

- Mantén el código modular y las responsabilidades claramente separadas.
- Usa el comando `agent-sudo "motivo breve" <comando>` en lugar de `sudo` para solicitar aprobación cuando lo requieras.
- Usa conventional commits como estandar para generar commits.

## OpenSpec

- Antes de proceder con un Propose, se debe crear los ADR o actualizar el glosario si es necesario.
- Al archivar un cambio de OpenSpec, sincroniza siempre sus deltas con las especificaciones principales y después archiva el cambio. Ejecuta ambas acciones automáticamente, sin preguntar si desea sincronizar; solo detente si la sincronización falla o existe un bloqueo real.

