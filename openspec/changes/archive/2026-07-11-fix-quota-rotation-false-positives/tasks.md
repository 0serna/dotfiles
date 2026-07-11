## 1. Core Logic

- [x] 1.1 Add `triedAccountsThisTurn: Set<string>` module state, initialized on `session_start` and cleared on `turn_start`
- [x] 1.2 Add `isQuotaExhaustionError(errorMessage?: string): boolean` helper that checks for `GoUsageLimitError` substring
- [x] 1.3 Gate `handleMessageEnd` rotation on `isQuotaExhaustionError` — skip rotation + continue for transient errors
- [x] 1.4 Track attempted account names in `triedAccountsThisTurn` when rotating
- [x] 1.5 Before rotating, check if all configured accounts are in `triedAccountsThisTurn` — if so, notify UI and stop without rotate/continue

## 2. Tests

- [x] 2.1 Add tests in `tests/` for `isQuotaExhaustionError`: true for `GoUsageLimitError`, false for timeout/stream errors
- [x] 2.2 Add rotation unit tests: rotate on quota error, skip on timeout, skip on stream interruption
- [x] 2.3 Add cycle exhaustion test: rotation stops after all accounts attempted, notifies UI
- [x] 2.4 Add per-turn reset test: `triedAccountsThisTurn` cleared on `turn_start`

## 3. Quality Gate

- [x] 3.1 Run `npm run check` in dotfiles repo — ensure lint, typecheck, and tests pass
- [x] 3.2 Verify `openspec validate --change fix-quota-rotation-false-positives` passes
