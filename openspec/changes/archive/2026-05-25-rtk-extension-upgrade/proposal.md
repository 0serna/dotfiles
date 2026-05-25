## Why

The current RTK extension uses synchronous `spawnSync`, registers an unnecessary bash tool override, and handles `user_bash` events — three design choices that diverge from the official upstream RTK Pi hook. Aligning with upstream brings async execution, availability gating, AbortSignal support, and a thinner architecture where the extension only mutates `tool_call` commands in-place.

## What Changes

- **BREAKING**: Remove bash tool override (`createBashTool` + `pi.registerTool`). The extension no longer replaces the built-in bash tool; it only hooks `tool_call` to mutate `event.input.command`.
- **BREAKING**: Remove `user_bash` handler. User `!` commands are no longer intercepted by this extension.
- Switch from synchronous `spawnSync` to async `pi.exec` for calling `rtk rewrite`, enabling AbortSignal propagation via `ctx.signal`.
- Add availability check at load time: probe `rtk --version`, warn and disable if killed, non-zero exit, or spawn error.
- Add `RTK_DISABLED=1` environment variable support to bypass all rewriting.
- Add recursion guard: skip commands already starting with `rtk `.
- Add input validation: skip non-string or empty commands.
- Add error handling with fail-open semantics: unexpected errors never block execution.
- Reduce rewrite timeout from 3000ms to 2000ms (matching upstream).

## Capabilities

### New Capabilities

None. This change modifies existing behavior rather than introducing new capabilities.

### Modified Capabilities

- `rtk-command-optimization`: Remove `user_bash` interception requirement and bash tool override requirement. Add availability gating, disable mechanism, recursion guard, input validation, error handling, and async execution requirements.

## Impact

- Affected file: `dotfiles/pi/agent/extensions/rtk/index.ts` (single file, ~50 lines → ~45 lines)
- Removes dependency on `child_process.spawnSync` and `createLocalBashOperations`
- No new dependencies
- No API changes to other extensions or the rest of the dotfiles system
