## 1. Rewrite `rtk-rewrite.ts`

- [x] 1.1 Replace the current event-based agent bash interception with `createBashTool(cwd, { spawnHook })` + `pi.registerTool()`
- [x] 1.2 Implement `rtkRewriteCommand()` using `spawnSync` that accepts exit codes 0 and 3 as valid rewrites, with 3000ms timeout
- [x] 1.3 Drop `parseCompoundCommand()`, `hasUnsupportedSyntax()`, `isCompoundOperator()`, `debugLog()`, and related code
- [x] 1.4 Rewrite `user_bash` handler with `excludeFromContext` guard and per-call rewrite in `exec`
- [x] 1.5 Remove unused imports (`isToolCallEventType`, `appendFileSync`, `BashResult`, etc.)

## 2. Verify

- [x] 2.1 Run `npm run check` to confirm TypeScript, lint, and formatting pass
- [x] 2.2 Manual smoke test: agent runs a command that `rtk` can rewrite (e.g., `ls -la`) and the rewritten version executes
- [x] 2.3 Manual smoke test: user runs `!ls -la` and the rewritten version executes
- [x] 2.4 Manual smoke test: user runs `!!ls -la` and the original command executes unmodified
- [x] 2.5 Manual smoke test: agent runs a command with no RTK equivalent (e.g., `echo hello`) and the original executes
