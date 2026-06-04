## Why

Pi extensions currently log failures with inconsistent payloads: some preserve only a message string while web-search now captures structured error and HTTP response details. Moving diagnostic helpers into shared code gives all extensions the same failure vocabulary without turning the logger itself into a specialized HTTP/error framework.

## What Changes

- Add a shared diagnostics module for pi extensions with structured error serialization and HTTP response helpers.
- Move the web-search-specific diagnostics helpers to the shared module and update web-search to consume them.
- Add a small composed helper for failure payloads so callers can log `{ error, response? }` consistently.
- Apply the shared diagnostics helpers to obvious existing extension failure logs where behavior and control flow remain unchanged.
- Keep `shared/logger` focused on JSONL transport, context injection, truncation, and best-effort writes.
- Do not standardize event names globally in this change.

## Capabilities

### New Capabilities

- `shared-diagnostics`: Shared structured diagnostics helpers for extension errors and HTTP response failures.

### Modified Capabilities

- `shared-logger`: Clarify that shared logging remains transport-focused and diagnostics live in a separate shared module.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/shared/*`, `dotfiles/pi/agent/extensions/web-search/*`, and selected existing extension logs in `quota` and `context`.
- Affected log payloads: selected migrated logs replace plain `message` fields with structured `error` objects and may include `response` details for HTTP failures.
- No dependency changes.
- No global event-name migration.
