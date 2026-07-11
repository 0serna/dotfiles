## Context

Actualmente existen dos extensiones de Pi separadas que miden aspectos del agente:

- `working-time`: hookea `agent_start`/`agent_end`, muestra `"Working Xm Ys"` vía `setWorkingMessage` con un intervalo de 1s.
- `tps`: hookea `session_start`/`message_update`/`message_end`, muestra throughput de tokens (`"N tok/s"`) en el footer vía `setStatus("tps", ...)` con su propio intervalo de 1s.

Ambas tienen intervalos independientes de 1 segundo. `tps/core.ts` contiene funciones puras para estimar tokens desde deltas y computar throughput. El display está en dos ubicaciones distintas del TUI (working message vs footer status).

El glosario en `CONTEXT.md` ya define los términos **live throughput**, **final throughput**, y **last final throughput**.

## Goals / Non-Goals

**Goals:**

- Unificar ambas extensiones en una sola (`working-time/`)
- Mostrar ambas métricas en el working message inline: `Working Xm Ys · N tok/s`
- Eliminar el intervalo duplicado
- Encapsular la lógica de throughput en un módulo profundo (`throughput.ts`)
- Eliminar la extensión `tps/` por completo

**Non-Goals:**

- Cambiar la precisión de la estimación de tokens (sigue siendo `chars/4`)
- Añadir métricas adicionales (prompt throughput, latency, etc.)
- Modificar `format.ts`

## Decisions

### Module decomposition

Se extrae un módulo `throughput.ts` que implementa `ThroughputTracker`, una máquina de estados con esta interfaz:

```
startStream(): void          — inicia medición de un nuevo stream
addDelta(delta: string): void — acumula tokens estimados durante streaming
endStream(tokens?: number): void — finaliza con tokens precisos (o sin datos)
reset(): void                — vuelve al estado inicial
getDisplay(): string | null  — "48 tok/s" o null (solo live)
getFinalThroughput(): string | null — "48 tok/s" o null (para completed)
```

Estados internos: `idle → streaming → final`. El estado `final` preserva el último valor internamente solo para la notificación `Completed`. Durante la ejecución de herramientas, `getDisplay()` retorna `null` y el working message muestra el placeholder `- tok/s`. Un nuevo `startStream()` transiciona de `final` a `streaming`.

**Alternativa considerada:** mantener la lógica inline en `index.ts`. Rechazada porque acoplaría el wiring de hooks con la máquina de estados, dificultando el testeo unitario.

### Display composition

El working message se compone así en cada tick del intervalo:

| Estado del tracker | Display                   |
| ------------------ | ------------------------- |
| `idle` o `final`   | `Working Xm Ys · - tok/s` |
| `streaming`        | `Working Xm Ys · N tok/s` |

Tanto `"Working Xm Ys"` como el throughput usan `theme.fg("muted", ...)`. El valor final (preciso del provider) solo se muestra en la notificación `Completed in Xm Ys · N tok/s` al terminar el agente.

**Decisión de diseño:** El usuario prefirió no mostrar throughput durante la ejecución de herramientas. El placeholder `- tok/s` toma su lugar inmediatamente al terminar un stream. Esto evita mostrar un valor obsoleto durante herramientas largas y simplifica el display.

### Spinner animation

Se reemplazó el indicador estático `▸` por un spinner braille animado con 10 frames (`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`) a 80ms por frame, dando feedback visual más claro de que el agente está trabajando.

### Intervalo unificado

Un solo `setInterval` de 1s que llama a `updateDisplay(ctx)`. Esta función consulta `Date.now() - startTime` para el tiempo y `tracker.getDisplay()` para el throughput, y compone el string.

El intervalo se crea en `agent_start` y se destruye en `agent_end` y `session_shutdown`.

**Alternativa considerada:** mantener dos intervalos independientes. Rechazada por redundancia — ambas métricas necesitan actualizarse cada segundo.

### Eliminación de `setStatus`

Se abandona `ctx.ui.setStatus("tps", ...)` completamente. El throughput se muestra exclusivamente como parte del working message (live) y en la notificación `Completed` (final). Esto libera el footer status key `"tps"` para otras extensiones.

### Ubicación de `core.ts`

La lógica de `tps/core.ts` se absorbe en `throughput.ts`. Las funciones `estimateTokensFromDelta`, `computeThroughput`, `formatThroughput`, e `isOutputDeltaEvent` se vuelven privadas del módulo o helpers exportados para testeo.

**Alternativa considerada:** importar desde `tps/core.ts`. Rechazada porque crea un acoplamiento entre directorios y `tps/` debe eliminarse por completo.

## Risks / Trade-offs

- **Divergencia de specs**: Los specs existentes `pi-agent-duration-footer` y `pi-assistant-throughput-footer` describen publicación vía status keys en el footer. El código real ya divergió (working-time usa `setWorkingMessage`, no `setStatus`). Este cambio formaliza la divergencia en los specs. → Se crean specs delta que documentan el nuevo comportamiento.
- **Pérdida de visibilidad en footer**: El throughput ya no aparece en el footer. Si otras extensiones o el footer custom dependían de ese status key, dejará de funcionar. → No hay dependencias conocidas; el footer custom en `pi-codex-usage-footer` es independiente.
- **Placeholder entre streams**: Durante la ejecución de herramientas no se muestra ningún throughput, solo el placeholder `- tok/s`. El último valor final se recupera en la notificación `Completed`. → Simplifica el display y evita confusión con valores obsoletos.
