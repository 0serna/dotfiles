# shared-logger Specification

## Purpose

The shared logger provides a single `log(extension, event, data)` function that all pi extensions use for diagnostic logging, ensuring consistent path, format, truncation, and error handling.

## Requirements

### Requirement: Log API

The shared logger SHALL expose a function `log(extension, event, data)` that writes a single log entry.

#### Scenario: Log call with data

- **WHEN** `log` is called with an extension name, event name, and data object
- **THEN** a single line SHALL be appended to the log file for that extension

#### Scenario: Log call without data

- **WHEN** `log` is called with only extension and event (no data)
- **THEN** a single line SHALL be appended

### Requirement: Log file path

Each extension SHALL write to its own log file at `~/.local/state/pi/<extension>.log`.

#### Scenario: Path derived from extension name

- **WHEN** `log('web-tools', ...)` is called
- **THEN** the entry SHALL be written to `~/.local/state/pi/web-tools.log`

#### Scenario: Parent directory auto-created

- **WHEN** the `~/.local/state/pi/` directory does not exist on first write
- **THEN** the directory SHALL be created automatically

### Requirement: Line format

Each log entry SHALL be a single JSON object per line.

#### Scenario: All fields inside JSON

- **WHEN** any entry is written
- **THEN** the line SHALL be a valid JSON object containing at minimum `timestamp` (ISO 8601), `extension`, and `event`

#### Scenario: Entry without data

- **WHEN** `log` is called without a data argument
- **THEN** the line SHALL be `{"timestamp":"...","extension":"...","event":"..."}\n`

#### Scenario: Entry with JSON data

- **WHEN** `log` is called with a data object
- **THEN** the line SHALL be `{"timestamp":"...","extension":"...","event":"...",...data}\n` with user data merged inside the same JSON object

#### Scenario: Trailing newline

- **WHEN** any entry is written
- **THEN** it SHALL end with a newline character

### Requirement: Log size management

The shared logger SHALL prevent unbounded log file growth by truncating to a fixed maximum number of lines.

#### Scenario: Trim oldest entries

- **WHEN** a log file exceeds 2000 lines after appending
- **THEN** the file SHALL be rewritten keeping only the most recent 2000 lines

### Requirement: Error resilience

The shared logger SHALL never throw or reject — all errors during logging SHALL be silently caught.

#### Scenario: Write error caught

- **WHEN** a filesystem error occurs during append (permissions, disk full, etc.)
- **THEN** the error SHALL be silently caught and the extension SHALL continue without interruption

#### Scenario: Truncation error caught

- **WHEN** a filesystem error occurs during truncation
- **THEN** the error SHALL be silently caught and the existing log file SHALL be left unchanged

#### Scenario: JSON serialization error caught

- **WHEN** the data object cannot be JSON-serialized (e.g., circular reference, BigInt)
- **THEN** the logger SHALL still write the timestamp/extension/event entry without the data portion, and SHALL not throw

### Requirement: Extension logger factory

The shared logger SHALL expose a function `createExtensionLogger(ctx, extension)` that returns a bound logger instance. The returned logger SHALL have a `log(event, data?)` method that writes entries identically to `log(extension, event, data)` but with the extension pre-bound.

#### Scenario: Factory returns bound logger

- **WHEN** `createExtensionLogger(ctx, 'codex-quota')` is called
- **THEN** the returned logger SHALL write to `~/.local/state/pi/codex-quota.log`
- **THEN** calling `logger.log('fetch_succeeded', { remaining: 85 })` SHALL produce a line with extension `codex-quota` and event `fetch_succeeded`

#### Scenario: Factory with no initial session

- **WHEN** `createExtensionLogger` is called with a context whose session manager has no active session
- **THEN** the returned logger SHALL include `sessionId: null` in the JSON payload

#### Scenario: Factory preserves existing log API

- **WHEN** the module is imported
- **THEN** the bare `log(extension, event, data)` function SHALL remain exported and unchanged

### Requirement: Context auto-injection

The factory-bound logger SHALL automatically include `sessionId` and `model` fields in the JSON payload of every log entry, sourced from the `ExtensionContext` provided at creation.

#### Scenario: Session ID captured at creation

- **WHEN** a logger is created via `createExtensionLogger(ctx, extension)` at session start
- **THEN** every entry from that logger SHALL include `sessionId` set to `ctx.sessionManager.getSessionId()` (the value at creation time)

#### Scenario: Model read live on each call

- **WHEN** `logger.log('event', data)` is called
- **THEN** the entry SHALL include `model` set to `ctx.model?.id ?? null` evaluated at the time of the log call

#### Scenario: User data merged with context fields

- **WHEN** `logger.log('event', { custom: 1 })` is called
- **THEN** the JSON payload SHALL contain `timestamp`, `extension`, `event`, `sessionId`, `model`, and `custom` — with `sessionId` and `model` appearing before any user-supplied keys

#### Scenario: User data key collision

- **WHEN** `logger.log('event', { sessionId: 'override' })` is called
- **THEN** the user-supplied value SHALL NOT override the auto-injected `sessionId` — the auto-injected value SHALL take precedence

### Requirement: Module-level safety

The shared logger module SHALL have no side effects at import time.

#### Scenario: Import is safe

- **WHEN** the module is imported
- **THEN** no filesystem operations SHALL be performed
- **THEN** no exceptions SHALL be thrown
