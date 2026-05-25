## ADDED Requirements

### Requirement: Extension gates on rtk availability

The extension SHALL verify `rtk` availability at load time via `pi.exec("rtk", ["--version"])`. If `rtk` is not found, the extension SHALL emit a warning to stderr and return without registering any handlers.

#### Scenario: rtk binary is found

- **WHEN** the extension loads and `rtk --version` exits 0
- **THEN** the extension SHALL register its `tool_call` handler

#### Scenario: rtk is not installed

- **WHEN** the extension loads and `rtk --version` fails (non-zero exit or spawn error)
- **THEN** the extension SHALL emit a warning and register no handlers

### Requirement: RTK_DISABLED env var bypasses rewriting

The extension SHALL check the `RTK_DISABLED` environment variable on each `tool_call`. When set to `"1"`, the extension SHALL pass the command through unchanged.

#### Scenario: RTK_DISABLED is set

- **WHEN** `RTK_DISABLED=1` and the agent calls the bash tool
- **THEN** the extension SHALL NOT attempt `rtk rewrite` and SHALL NOT mutate `event.input.command`

#### Scenario: RTK_DISABLED is not set

- **WHEN** `RTK_DISABLED` is absent or set to any value other than `"1"` and the agent calls the bash tool
- **THEN** the extension SHALL attempt `rtk rewrite` normally

### Requirement: Commands already prefixed with rtk are not rewritten

The extension SHALL skip commands that already start with `"rtk "` to prevent recursive rewrite chains.

#### Scenario: Command starts with rtk prefix

- **WHEN** the agent calls the bash tool with `"rtk git status"`
- **THEN** the extension SHALL NOT attempt `rtk rewrite`

#### Scenario: Command contains rtk but not as prefix

- **WHEN** the agent calls the bash tool with `"which rtk"`
- **THEN** the extension SHALL attempt `rtk rewrite` normally

### Requirement: Non-string or empty commands are skipped

The extension SHALL validate that `event.input.command` is a non-empty string before attempting rewrite.

#### Scenario: Command is empty

- **WHEN** the agent calls the bash tool with an empty string command
- **THEN** the extension SHALL return without attempting `rtk rewrite`

#### Scenario: Command is not a string

- **WHEN** `event.input.command` is not a string (e.g., undefined or null)
- **THEN** the extension SHALL return without attempting `rtk rewrite`

### Requirement: Unexpected errors fail open

The extension SHALL wrap its `tool_call` handler in a try/catch block. If an unexpected error occurs during rewrite, the extension SHALL log a warning and return without blocking execution.

#### Scenario: Error thrown during rewrite

- **WHEN** an unexpected error occurs inside the `tool_call` handler (outside of `pi.exec` result handling)
- **THEN** the extension SHALL log a warning to stderr
- **THEN** the original command SHALL execute unchanged (no mutation to `event.input.command`)

### Requirement: Rewrite uses async pi.exec with AbortSignal

The extension SHALL call `rtk rewrite` via Pi's async `pi.exec` API with a 2000ms timeout and the agent's `ctx.signal` for abort propagation.

#### Scenario: pi.exec succeeds with rewrite

- **WHEN** `pi.exec("rtk", ["rewrite", cmd])` exits with code 0 or 3 and produces non-empty stdout
- **THEN** the extension SHALL mutate `event.input.command` to the rewritten command

#### Scenario: pi.exec killed by signal

- **WHEN** `pi.exec` is killed (e.g., via Esc abort propagated through `ctx.signal`)
- **THEN** the extension SHALL return without mutating the command

#### Scenario: pi.exec times out

- **WHEN** `pi.exec` does not complete within 2000ms
- **THEN** the extension SHALL return without mutating the command

## MODIFIED Requirements

### Requirement: Bash commands are rewritten via rtk

The extension SHALL intercept agent-initiated bash tool calls and attempt to rewrite them via `rtk rewrite`. If rewriting succeeds, the rewritten command SHALL be used instead. If rewriting fails (no rewrite available, `rtk` unavailable, or timeout), the original command SHALL execute unchanged.

#### Scenario: Agent bash tool call is rewritten

- **WHEN** the agent calls the bash tool with a command that `rtk rewrite` can optimize (exit code 0 or 3 with non-empty stdout)
- **THEN** `event.input.command` SHALL be mutated to the rewritten command

#### Scenario: Agent bash tool call has no rewrite

- **WHEN** the agent calls the bash tool with a command that `rtk rewrite` cannot optimize (exit code 1 or empty stdout)
- **THEN** `event.input.command` SHALL remain unchanged

#### Scenario: rtk is unavailable

- **WHEN** `rtk` is not installed or fails to spawn
- **THEN** the original command SHALL execute unchanged, with no error surfaced to the user

#### Scenario: rtk times out

- **WHEN** `rtk rewrite` does not complete within 2000ms
- **THEN** the original command SHALL execute unchanged

### Requirement: Interception uses tool_call event hook

For agent bash tool calls, the extension SHALL subscribe to the `tool_call` event and narrow to the `bash` tool via `isToolCallEventType`. The extension SHALL NOT register a replacement bash tool via `pi.registerTool`.

#### Scenario: tool_call fires for bash

- **WHEN** the agent calls the bash tool
- **THEN** the `tool_call` handler SHALL be invoked and may mutate `event.input.command`

#### Scenario: tool_call fires for non-bash tool

- **WHEN** the agent calls any tool other than bash
- **THEN** the `tool_call` handler SHALL return without side effects

## REMOVED Requirements

### Requirement: User `!` commands are rewritten

**Reason**: Aligning with upstream RTK Pi extension which deliberately scopes to agent-initiated `bash` tool calls only. User `!` commands are a separate execution path that requires claiming the `user_bash` event (first-handler-wins), which would make the extension responsible for all shell execution.

**Migration**: Users who want `!` command optimization can install a separate extension (e.g., `pi-rtk` package). This extension now only handles agent `tool_call` events.
