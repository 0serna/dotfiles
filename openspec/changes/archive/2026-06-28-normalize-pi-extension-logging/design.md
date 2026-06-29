## Context

The shared pi extension logger currently supports both a bare `log(extension, event, data?)` API and `createExtensionLogger(ctx, extension)`. Bound loggers inject `sessionId` and `model`, but log entries use a flat JSON object where user payload fields can collide with reserved metadata such as `timestamp`, `extension`, and `event`.

Existing local log files also contain a mix of current JSONL and legacy non-JSON formats. The active logger users are `quota`, `context`, `permissions`, and `web-search`; older files such as `codex-quota.log`, `usage-quota.log`, `context-usage.log`, `dcp.log`, and `commit-command.log` are deprecated.

## Goals / Non-Goals

**Goals:**

- Standardize logging through `createExtensionLogger` only.
- Emit one normalized JSON object per line with reserved metadata at top level and user payload under `data`.
- Always include `data`, defaulting to `{}`.
- Keep destination creation and append-only behavior for normal writes.
- Reduce truncation overhead by truncating only after the file exceeds 10 MB, then retaining approximately the most recent 5 MB on complete JSONL line boundaries.
- Normalize local log state by clearing active logs and removing deprecated logs.

**Non-Goals:**

- Introduce asynchronous logging.
- Add log rotation files or size-based retention.
- Preserve legacy log history.
- Add external logging dependencies.

## Decisions

- Use only `createExtensionLogger` as the public API. This guarantees each entry has extension context plus session/model metadata and removes the non-contextual bare logging path.
- Nest user payload under `data`. This avoids maintaining a growing reserved-key collision list and makes metadata/payload boundaries explicit.
- Include `data: {}` for all entries. This keeps the schema stable for parsers even when no payload is supplied or payload serialization fails.
- Keep synchronous filesystem writes. Current usage volume does not justify async complexity, and fire-and-forget async logging could lose entries during shutdown.
- Use size-based threshold truncation with hysteresis: maximum threshold 10 MB, retain approximately 5 MB once exceeded. This avoids line-counting on every append and preserves recent diagnostics while keeping JSONL lines complete.
- Normalize existing local state destructively. Active logs are emptied and deprecated logs are removed because the change intentionally starts a clean format boundary.

## Risks / Trade-offs

- **Consumers expecting flat fields break** → The format change is explicitly breaking and scoped to local diagnostic logs.
- **Consumers importing bare `log()` break** → Repository consumers should migrate to `createExtensionLogger`; no current extension usage of bare `log()` was found.
- **Large truncation discards a block of history** → The retained newest ~5 MB preserve recent diagnostics while reducing rewrite frequency.
- **Synchronous truncation can still be expensive when triggered** → Truncation happens far less often than before and remains simple/reliable.
