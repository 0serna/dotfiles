## Comunicación y formato

- Usa español neutro y un lenguaje claro en los mensajes dirigidos al usuario.
- Usa inglés para código, archivos y demás, excepto cuando el idioma forme parte del comportamiento o traducciones.

## Código y herramientas

- Mantén el código modular y las responsabilidades claramente separadas.
- Usa el comando `agent-sudo "motivo breve" <comando>` en lugar de `sudo` para solicitar aprobación cuando lo requieras.
- Siempre debes usar por defecto el in-app browser. Debes evitar usar el navegador externo. El usuario es quien decide cuándo puedes usarlo.

## Uso de subagentes

- Al delegar, especifica siempre `model` y `thinking` con sus identificadores literales.
- Para explorar archivos o proyectos, delega a un subagente con `model: "gpt-5.6-luna"` y `thinking: "high"`.
- Para investigar en la web, delega a un subagente con `model: "gpt-5.6-luna"` y `thinking: "high"`.
- Para consultas de asesoría cuando exista un bloqueo o un problema complejo, delega a un subagente con `model: "gpt-6-astra"` y `thinking: "low"`.
- Cada subagente debe iniciar con contexto fresco. Evita `fork_thread` o cualquier mecanismo que herede el historial de otra tarea.
