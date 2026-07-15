## 1. Preference Model

- [x] 1.1 Add failing tests for thinking-memory-only persistence and lazy legacy migration.
- [x] 1.2 Remove persisted selection from manual preferences while retaining legacy-compatible reads.

## 2. Session Baseline

- [x] 2.1 Add failing lifecycle tests for Pi-owned startup selection, late baseline capture, and settled restoration.
- [x] 2.2 Separate the session baseline from thinking memory and use it for route restoration.
- [x] 2.3 Update transition terminology and comments to remove session-start restoration semantics.

## 3. Domain Contract

- [x] 3.1 Update `CONTEXT.md` from session manual selection to session baseline selection and remove obsolete persisted-selection language.
- [x] 3.2 Update the living `pi-model-routing` specification with the validated delta behavior.

## 4. Verification

- [x] 4.1 Run focused model-routing tests and fix all findings.
- [x] 4.2 Run formatting, lint, typecheck, full tests, and OpenSpec validation.
