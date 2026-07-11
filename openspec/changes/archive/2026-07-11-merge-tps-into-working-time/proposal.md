## Why

Las extensiones `tps` y `working-time` existen como extensiones separadas pero miden aspectos complementarios del agente (throughput de tokens y tiempo transcurrido). Ambas usan intervalos de 1s independientes y publican en ubicaciones distintas del TUI. Unificarlas en una sola extensión con un display compuesto reduce ruido visual, elimina el intervalo duplicado y concentra las métricas de actividad del agente en un solo lugar.

## What Changes

- **MOVER** la lógica de throughput de `tps/index.ts` a un módulo `throughput.ts` dentro de `working-time/`
- **ELIMINAR** la extensión `tps/` completa (index.ts, core.ts, tests)
- **UNIFICAR** los dos intervalos de 1s en uno solo compartido
- **CAMBIAR** el display de throughput de `setStatus("tps", ...)` a `${setWorkingMessage}(...)` inline junto al tiempo
- **MOSTRAR** el throughput con tres estados: placeholder (`- tok/s`), live durante streaming, y final congelado con sufijo `(last)` entre streams
- **MANTENER** `format.ts` sin cambios
- **ACTUALIZAR** tests para cubrir el comportamiento unificado

## Capabilities

### New Capabilities

- `pi-working-time-throughput`: Display unificado de tiempo de trabajo del agente y throughput de tokens del asistente, renderizado como mensaje de trabajo inline (`Working Xm Ys · N tok/s`).

### Modified Capabilities

- `pi-agent-duration-footer`: Elapsed time ya no se publica como status key independiente; se integra en el working message unificado.
- `pi-assistant-throughput-footer`: Throughput ya no se publica como status key independiente; se integra en el working message unificado. La extensión `tps/` se elimina.

## Impact

- **Eliminado**: `dotfiles/pi/agent/extensions/tps/` (index.ts, core.ts, tests/)
- **Modificado**: `dotfiles/pi/agent/extensions/working-time/index.ts` (añade hooks de streaming, unifica intervalo)
- **Nuevo**: `dotfiles/pi/agent/extensions/working-time/throughput.ts` (máquina de estados de throughput)
- **Modificado**: `dotfiles/pi/agent/extensions/working-time/tests/extension.test.ts` (añade cobertura de throughput)
- **Nuevo**: `dotfiles/pi/agent/extensions/working-time/tests/throughput.test.ts` (tests unitarios del tracker)
- **Sin cambios**: `dotfiles/pi/agent/extensions/working-time/format.ts`
