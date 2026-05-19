# shared-logger Specification

> **Delta spec**: this file modifies the base spec at `openspec/specs/shared-logger/spec.md` for the `improve-extension-logger` change.

## ADDED Requirements

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

## REMOVED Requirements

_(none)_

## MODIFIED Requirements

_(none — existing requirements for log path, format, size management, error resilience, and module safety remain unchanged)_
