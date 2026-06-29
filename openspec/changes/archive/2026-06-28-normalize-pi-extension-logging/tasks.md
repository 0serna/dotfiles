## 1. Logger API and Format

- [x] 1.1 Remove the public bare `log(extension, event, data?)` export from the shared logger module.
- [x] 1.2 Update logger formatting so every entry contains top-level `timestamp`, `extension`, `event`, `sessionId`, `model`, and `data`.
- [x] 1.3 Ensure user payload is always nested under `data`, including payload keys that collide with reserved metadata names.
- [x] 1.4 Ensure calls without payload, or with unserializable payload, write `data: {}` and never throw.

## 2. Retention and File Behavior

- [x] 2.1 Change retention constants to truncate only after more than 10 MB.
- [x] 2.2 Change truncation to retain approximately the most recent 5 MB on complete JSONL line boundaries once the threshold is exceeded.
- [x] 2.3 Verify missing log directories and files are created automatically on first write.
- [x] 2.4 Verify normal writes append to existing files without clearing them below the truncation threshold.

## 3. Consumers and Tests

- [x] 3.1 Update any imports or consumers that depend on the removed bare logger API.
- [x] 3.2 Add or update tests for bound logger output shape, reserved-key collisions, empty `data`, destination creation, append behavior, isolated test log storage, and size-based truncation.
- [x] 3.3 Run repository quality gates and fix any failures.

## 4. Local Log State Normalization

- [x] 4.1 Clear active log files: `quota.log`, `context.log`, `permissions.log`, and `web-search.log` if present.
- [x] 4.2 Remove deprecated log files: `codex-quota.log`, `usage-quota.log`, `context-usage.log`, `dcp.log`, and `commit-command.log` if present.
- [x] 4.3 Verify the active logs are empty or recreated on next write, and deprecated logs are absent.
