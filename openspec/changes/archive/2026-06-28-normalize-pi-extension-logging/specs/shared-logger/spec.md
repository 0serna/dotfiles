## REMOVED Requirements

### Requirement: Log API

**Reason**: The bare `log(extension, event, data)` API allows non-contextual logging and bypasses the standard session/model metadata injected by bound extension loggers.

**Migration**: Consumers MUST create a logger with `createExtensionLogger(ctx, extension)` and call `logger.log(event, data?)`.

## MODIFIED Requirements

### Requirement: Line format

Each log entry SHALL be a single JSON object per line with reserved metadata at the top level and user payload nested under `data`.

#### Scenario: All fields inside JSON

- **WHEN** any entry is written
- **THEN** the line SHALL be a valid JSON object containing at minimum `timestamp` (ISO 8601), `extension`, `event`, `sessionId`, `model`, and `data`

#### Scenario: Entry without data

- **WHEN** a bound logger is called without a data argument
- **THEN** the line SHALL include `data: {}`

#### Scenario: Entry with JSON data

- **WHEN** a bound logger is called with a data object
- **THEN** the line SHALL contain reserved metadata fields at the top level
- **AND** the user payload SHALL be written under the top-level `data` object

#### Scenario: Payload key collision

- **WHEN** a bound logger is called with data containing keys such as `timestamp`, `extension`, `event`, `sessionId`, or `model`
- **THEN** those keys SHALL remain inside `data`
- **AND** the top-level reserved metadata fields SHALL NOT be overwritten by payload values

#### Scenario: Trailing newline

- **WHEN** any entry is written
- **THEN** it SHALL end with a newline character

### Requirement: Log size management

The shared logger SHALL prevent unbounded log file growth by truncating only after a file exceeds 10 MB, then keeping approximately the most recent 5 MB without breaking JSONL lines.

#### Scenario: Under maximum size threshold

- **WHEN** a log file is 10 MB or smaller after appending
- **THEN** the logger SHALL leave all existing lines in place

#### Scenario: Trim oldest bytes after threshold

- **WHEN** a log file exceeds 10 MB after appending
- **THEN** the file SHALL be rewritten keeping approximately the most recent 5 MB
- **AND** the rewritten file SHALL start at a complete JSONL line boundary
- **AND** the rewritten file SHALL NOT contain a partial first line

### Requirement: Extension logger factory

The shared logger SHALL expose `createExtensionLogger(ctx, extension)` as the public logger factory. The returned logger SHALL have a `log(event, data?)` method that writes entries for the pre-bound extension.

#### Scenario: Factory returns bound logger

- **WHEN** `createExtensionLogger(ctx, 'quota')` is called
- **THEN** the returned logger SHALL write to `~/.local/state/pi/quota.log`
- **THEN** calling `logger.log('fetch_succeeded', { remaining: 85 })` SHALL produce a line with top-level extension `quota`, top-level event `fetch_succeeded`, and `data.remaining` set to `85`

#### Scenario: Factory with no initial session

- **WHEN** `createExtensionLogger` is called with a context whose session manager has no active session
- **THEN** the returned logger SHALL include top-level `sessionId: null` in each JSON entry

#### Scenario: Bare log API is not exported

- **WHEN** the module is imported
- **THEN** no bare `log(extension, event, data)` function SHALL be exported as public API

### Requirement: Context auto-injection

The factory-bound logger SHALL automatically include top-level `sessionId` and `model` fields in every log entry, sourced from the context provided at creation.

#### Scenario: Session ID captured at creation

- **WHEN** a logger is created via `createExtensionLogger(ctx, extension)` at session start
- **THEN** every entry from that logger SHALL include top-level `sessionId` set to `ctx.sessionManager.getSessionId()` evaluated at creation time

#### Scenario: Model read live on each call

- **WHEN** `logger.log('event', data)` is called
- **THEN** the entry SHALL include top-level `model` set to `ctx.model?.id ?? null` evaluated at the time of the log call

#### Scenario: User data nested with context fields

- **WHEN** `logger.log('event', { custom: 1 })` is called
- **THEN** the JSON entry SHALL contain top-level `timestamp`, `extension`, `event`, `sessionId`, `model`, and `data`
- **AND** `data.custom` SHALL equal `1`

#### Scenario: User data key collision

- **WHEN** `logger.log('event', { sessionId: 'override', model: 'override' })` is called
- **THEN** the top-level `sessionId` and `model` SHALL use the auto-injected values
- **AND** the user-supplied values SHALL remain under `data.sessionId` and `data.model`

## ADDED Requirements

### Requirement: Active log normalization

The local pi log state SHALL be normalized for the new logger format by clearing active log files and removing deprecated legacy log files.

#### Scenario: Active logs are recreated empty

- **WHEN** the logger normalization is applied
- **THEN** active logs for `quota`, `context`, `permissions`, and `web-search` SHALL exist as empty files or be created on the next logger write

#### Scenario: Deprecated logs are removed

- **WHEN** the logger normalization is applied
- **THEN** deprecated logs `codex-quota.log`, `usage-quota.log`, `context-usage.log`, `dcp.log`, and `commit-command.log` SHALL be removed from `~/.local/state/pi/`

### Requirement: Destination creation and append behavior

The shared logger SHALL create missing destination directories and log files, and SHALL append to existing log files without clearing them during normal writes.

#### Scenario: Missing destination file

- **WHEN** a bound logger writes an entry and the destination log file does not exist
- **THEN** the logger SHALL create the destination file and write the entry

#### Scenario: Existing destination file

- **WHEN** a bound logger writes an entry and the destination log file already exists below the truncation threshold
- **THEN** the logger SHALL append the new entry without deleting existing lines
