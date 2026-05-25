## 1. Remove old implementation artifacts

- [x] 1.1 Remove `spawnSync` import and synchronous `rtkRewriteCommand` function
- [x] 1.2 Remove `createBashTool` import and `pi.registerTool(bashTool)` registration
- [x] 1.3 Remove `createLocalBashOperations` import and entire `user_bash` event handler
- [x] 1.4 Remove `BashOperations` type import and `VALID_RTK_EXITS` constant

## 2. Add new infrastructure

- [x] 2.1 Add load-time availability probe: call `pi.exec("rtk", ["--version"])`, bail with warning if killed or code != 0
- [x] 2.2 Convert extension factory from sync to async function

## 3. Implement tool_call handler with guards

- [x] 3.1 Rewrite `tool_call` handler to use async `pi.exec` with `{ timeout: 2000, signal: ctx.signal }`
- [x] 3.2 Add `RTK_DISABLED=1` environment variable check (skip if set)
- [x] 3.3 Add recursion guard: skip commands starting with `"rtk "`
- [x] 3.4 Add input validation: skip if `typeof cmd !== "string"` or `cmd.trim() === ""`
- [x] 3.5 Wrap handler body in try/catch with fail-open semantics (log warning, return)

## 4. Verify

- [x] 4.1 Verify the extension loads without errors via `pi -e` with rtk available
- [x] 4.2 Verify graceful degradation when rtk is missing (warning, no crash)
- [x] 4.3 Verify `RTK_DISABLED=1` bypasses all rewriting
- [x] 4.4 Run `npm run check` to ensure lint, types, and OpenSpec validation pass
