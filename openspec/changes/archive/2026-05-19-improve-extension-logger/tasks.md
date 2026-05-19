## 1. Refactor Logger Module

- [x] 1.1 Add `createExtensionLogger(ctx, extension)` factory function that returns `{ log(event, data?) }`
- [x] 1.2 Implement context auto-injection: capture `sessionId` at creation, read `model` from `ctx` on each log call
- [x] 1.3 Ensure auto-injected fields (`sessionId`, `model`) take precedence over user-supplied data on key collision
- [x] 1.4 Keep existing `log(extension, event, data)` export unchanged and sharing the same underlying writer
- [x] 1.5 Run `npm run check` to verify the module compiles and passes lint/type checks

## 2. Migrate Extensions to Factory Pattern

- [x] 2.1 Migrate `codex-quota.ts`: create logger in `session_start`, replace all 12 `log("codex-quota", ...)` calls
- [x] 2.2 Migrate `web-search.ts`: create logger in `session_start`, replace all 9 `log("web-tools", ...)` calls
- [x] 2.3 Migrate `permission.ts`: create logger in `session_start`, replace all 7 `log("permissions", ...)` calls
- [x] 2.4 Migrate `context-usage.ts`: create logger in `session_start`, replace all 3 `log("context-usage", ...)` calls

## 3. Verify

- [x] 3.1 Run `npm run check` — all quality gates green (TypeScript, linter, formatter, tests)
- [x] 3.2 Confirm sessionId appears in log output by inspecting a generated log file
- [x] 3.3 Confirm model appears in log output by inspecting a generated log file
