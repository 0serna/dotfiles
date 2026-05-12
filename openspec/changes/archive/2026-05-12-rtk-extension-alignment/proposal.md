## Why

The current RTK extension at `dotfiles/pi/agent/extensions/rtk-rewrite.ts` diverges significantly from the reference implementation at `sherif-fanous/pi-rtk`. It contains unnecessary complexity (custom compound command parser, debug logging) and has correctness gaps (missing `!!` bypass, closure-based exec pattern). Aligning with the reference's architecture reduces maintenance burden, fixes edge cases, and ensures the extension gets the most out of `rtk rewrite` for all context-visible commands.

## What Changes

- **Rewrite interception approach**: Switch from raw `tool_call` event hooks to `createBashTool(cwd, { spawnHook })` + `pi.registerTool()` for agent-initiated bash calls
- **Drop compound command parser**: Remove `parseCompoundCommand()`, `hasUnsupportedSyntax()`, and `isCompoundOperator()` — `rtk rewrite` handles `&&`, `||`, and pipes natively
- **Simplify error handling**: Replace detailed exit-code branching + debug logging with a focused `spawnSync` call that accepts exit codes 0 and 3 as valid rewrites and falls back to original command otherwise
- **Fix `!!` bypass**: Add `event.excludeFromContext` check in `user_bash` handler to skip rewriting `!!` commands
- **Fix `user_bash` exec pattern**: Rewrite per `exec` call instead of capturing once in a closure
- **Adjust timeout**: Change from 1000ms to 3000ms
- **Remove debug logging**: Delete `DEBUG`, `DEBUG_LOG`, and `debugLog()`

## Capabilities

### New Capabilities

- `rtk-command-optimization`: Automatic rewriting of bash commands using `rtk rewrite` to produce safer, more context-efficient alternatives. Handles both agent-initiated and user-initiated commands that are visible to the LLM context window.

### Modified Capabilities

None — this is an implementation alignment that preserves existing behavior.

## Impact

- **File**: `dotfiles/pi/agent/extensions/rtk-rewrite.ts` — substantial rewrite, ~260 lines → ~60 lines
- **Dependencies**: No new dependencies. Uses existing `@earendil-works/pi-coding-agent` exports (`createBashTool`, `createLocalBashOperations`, `BashOperations`, `ExtensionAPI`)
- **Behavior**: No user-visible changes. Commands are rewritten identically; only internal architecture changes.
