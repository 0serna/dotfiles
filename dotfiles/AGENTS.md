## Comunicación y formato

- Usa español neutro y un lenguaje claro en los mensajes dirigidos al usuario.
- Usa inglés para código, archivos y demás, excepto cuando el idioma forme parte del comportamiento o traducciones.

## Código y herramientas

- Mantén el código modular y las responsabilidades claramente separadas.
- Usa el comando `agent-sudo "motivo breve" <comando>` en lugar de `sudo` para solicitar aprobación cuando lo requieras.
- Siempre debes usar por defecto el in-app browser. Debes evitar usar el navegador externo. El usuario es quien decide cuándo puedes usarlo.

## Uso de subagentes

- Actúa como orquestador del trabajo. Decide qué tareas realizar directamente y cuáles delegar a subagentes cuando resulte útil.
- Al delegar, usa siempre `model: "gpt-5.6-luna"` y `thinking: "high"`.
- Da a cada subagente un encargo autocontenido y contexto fresco. Evita `fork_thread` y cualquier mecanismo que herede el historial de otra tarea.
