## Comunicación y formato

- Usa español neutro en todos los mensajes dirigidos al usuario.
- Usa inglés para código, archivos, PRs y demás, excepto cuando el idioma forme parte del comportamiento o de las traducciones.
- Comunicate usando ASD-STE100: frases cortas, una idea por frase, vocabulario simple.
- Prefiere un diagrama a un texto largo para flujos, estructuras o relaciones.

## Código y herramientas

- Mantén el código modular y las responsabilidades claramente separadas.
- Usa el comando `agent-sudo "motivo breve" <comando>` en lugar de `sudo` para solicitar aprobación cuando necesites privilegios elevados.

## OpenSpec

- Si es necesario inicializar OpenSpec en algún proyecto, debes usar `openspec init --tools none`.
- Antes de proceder con un `propose`, crea los ADR o actualiza el glosario si es necesario.
- Al proceder con `archive`, sincroniza siempre sus deltas sin preguntar; solo detente si la sincronización falla o existe un bloqueo real.
