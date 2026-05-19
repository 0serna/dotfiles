## Why

The shared logger requires every extension to repeat its name (`"codex-quota"`, `"web-tools"`, etc.) on every single log call (~40 calls across 5 extensions), and log entries lack session correlation — you can't tell which entries belong to the same conversation. This makes debugging multi-extension flows needlessly manual.

## What Changes

- Add `createExtensionLogger(ctx, extension)` factory that returns a bound logger (extension no longer repeated per call)
- Auto-inject `sessionId` and `model` into every log entry's JSON data, sourced from `ExtensionContext`
- Keep per-extension log files at `~/.local/state/pi/<extension>.log`
- Keep same error-resilient behavior (never throws)
- Keep 2000-line truncation per file
- Full JSON per line: `{"timestamp":"...","extension":"...","event":"...",...}`

## Capabilities

### New Capabilities

_(none — this modifies the existing shared logger)_

### Modified Capabilities

- `shared-logger`: log API gains a factory function with context-bound extension, session ID, and model auto-injection

## Impact

- **`dotfiles/pi/agent/extensions/shared/logger.ts`**: Add `createExtensionLogger`, refactor internal `log` to support context injection
- **4 extension files** consuming `log`: switch from bare `log("extension", "event", data)` to factory-based `logger.log("event", data)` — `codex-quota.ts`, `context-usage.ts`, `permission.ts`, `web-search.ts`
- **No breaking changes**: the existing `log(extension, event, data)` export signature is preserved for backward compatibility
