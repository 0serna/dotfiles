## 1. Status format refactoring

- [x] 1.1 Update `formatPercentResetSegment` to remove parentheses: `${label} ${percent}% ${reset}`
- [x] 1.2 Rewrite `selectCompactWindows` to return single window with exhausted priority (monthly > weekly > rolling)
- [x] 1.3 Remove window label from status output (no R/W/M prefix)
- [x] 1.4 Update exhausted state rendering: credits/balance in warning, resets accent/dim

## 2. /quota command

- [x] 2.1 Create `formatFullDetail` function in `status.ts` for block-formatted output
- [x] 2.2 Register `/quota` command in `index.ts` using `pi.registerCommand`
- [x] 2.3 Implement data refresh before display in command handler

## 3. Tests

- [x] 3.1 Update `codex-status.test.ts` assertions for new format
- [x] 3.2 Update `opencode-status.test.ts` assertions for new format
- [x] 3.3 Update `provider-status.test.ts` assertions for new format
- [x] 3.4 Add tests for `/quota` command output formatting
- [x] 3.5 Run `npm run check` and fix any issues
