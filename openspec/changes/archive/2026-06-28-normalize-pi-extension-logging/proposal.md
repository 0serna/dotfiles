## Why

Pi extension logging currently mixes a bare logger API with bound extension loggers, and the flat JSON payload allows user data to collide with reserved metadata fields. Existing log files also contain mixed legacy formats, making inspection and automated parsing less reliable.

## What Changes

- **BREAKING**: Remove the public bare `log(extension, event, data?)` API in favor of `createExtensionLogger(ctx, extension)` as the only public logging entry point.
- **BREAKING**: Change log entries from flat payload merging to a normalized JSONL structure with reserved metadata at the top level and user payload under `data`.
- Always include `data`, using `{}` when no payload is supplied or serialization of payload fails.
- Preserve automatic creation of `~/.local/state/pi/` and missing destination log files, while appending to existing files.
- Change log retention to a 10 MB file-size threshold and, when exceeded, retain approximately the most recent 5 MB without cutting JSONL lines.
- Normalize local state by clearing active logs and deleting deprecated legacy logs.

## Capabilities

### New Capabilities

### Modified Capabilities

- `shared-logger`: Standardize the public logger API, JSONL entry shape, append/create behavior, and truncation policy.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/shared/logger.ts` and its consumers/tests.
- Affected local state: `~/.local/state/pi/*.log` cleanup for active and deprecated logs.
- Affected API: consumers must use `createExtensionLogger`; bare `log()` import/use is no longer supported.
- No new runtime dependencies are expected.
