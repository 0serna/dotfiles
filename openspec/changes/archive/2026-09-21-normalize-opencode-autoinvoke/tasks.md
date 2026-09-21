# Tasks

## 1. Normalizador OpenCode

- [x] 1.1 Extender `normalizeSkills` con merge de `metadata.opencode/autoinvoke: false` en `SKILL.md` flagged y verificar que `npm run test` cubre fusión e idempotencia
- [x] 1.2 Verificar que la derivación OpenAI existente sigue intacta con `npm run test` (casos `openai.yaml` actuales en verde)

## 2. Cobertura de escenarios

- [x] 2.1 Añadir fixtures/tests: sin bloque `metadata`, con claves ajenas (`author/version/generatedBy` estilo `openspec-propose`), valor `true`/`"true"` a corregir, ya correcto, y sin flag intacto; verificar `npm run test` en verde
- [x] 2.2 Verificar segunda pasada idempotente (`0` cambios, contenido byte-idéntico) con `npm run test`

## 3. Verificación y docs

- [x] 3.1 Ejecutar `npm run check` y `npm run typecheck` y verificar ambos en verde
- [x] 3.2 Documentar el derivado OpenCode en `SKILL-MECHANICS.md` (mecánica user-invoked) y verificar que la descripción del mecanismo coincide con el comportamiento testeado
