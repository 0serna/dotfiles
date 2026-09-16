## Comunicación y formato

- Usa español neutro y un lenguaje claro en los mensajes dirigidos al usuario.
- Usa inglés para código, archivos y demás, excepto cuando el idioma forme parte del comportamiento o traducciones.

## Código y herramientas

- Mantén el código modular y las responsabilidades claramente separadas.
- Usa el comando `agent-sudo "motivo breve" <comando>` en lugar de `sudo` para solicitar aprobación cuando lo requieras.
- Siempre debes usar por defecto el in-app browser. El usuario es quien decide cuándo usar el navegador externo.

## Uso de subagentes

- Al delegar, prefiere `model: "gpt-5.6-luna"` y `thinking: "max"`.
- Da a cada subagente un encargo autocontenido y contexto fresco (evita `fork_thread`).
