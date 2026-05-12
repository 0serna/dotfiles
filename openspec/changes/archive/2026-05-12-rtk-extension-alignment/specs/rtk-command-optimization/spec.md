## ADDED Requirements

### Requirement: Bash commands are rewritten via rtk

The extension SHALL intercept bash commands from two sources — agent tool calls and user `!` commands — and attempt to rewrite them via `rtk rewrite`. If rewriting succeeds, the rewritten command SHALL be executed instead. If rewriting fails (no rewrite available, `rtk` unavailable, or timeout), the original command SHALL be executed as-is.

#### Scenario: Agent bash tool call is rewritten

- **WHEN** the agent calls the bash tool with a command that `rtk rewrite` can optimize (exit code 0 or 3 with non-empty stdout)
- **THEN** the rewritten command SHALL be executed instead of the original

#### Scenario: Agent bash tool call has no rewrite

- **WHEN** the agent calls the bash tool with a command that `rtk rewrite` cannot optimize (exit code 1 or 2, or empty stdout)
- **THEN** the original command SHALL be executed unchanged

#### Scenario: rtk is unavailable

- **WHEN** `rtk` is not installed or fails to spawn
- **THEN** the original command SHALL be executed unchanged, with no error surfaced to the user

#### Scenario: rtk times out

- **WHEN** `rtk rewrite` does not complete within the configured timeout (3000ms)
- **THEN** the original command SHALL be executed unchanged

### Requirement: User `!` commands are rewritten

The extension SHALL intercept user `!` commands and attempt to rewrite them via `rtk rewrite`, following the same success/failure rules as agent bash calls. User `!!` commands (excluded from LLM context) SHALL NOT be intercepted.

#### Scenario: User `!` command is rewritten

- **WHEN** the user issues a `!` command that `rtk rewrite` can optimize
- **THEN** the rewritten command SHALL be executed

#### Scenario: User `!` command has no rewrite

- **WHEN** the user issues a `!` command that `rtk rewrite` cannot optimize
- **THEN** the original command SHALL be executed unchanged

#### Scenario: User `!!` command is not intercepted

- **WHEN** the user issues a `!!` command
- **THEN** the extension SHALL NOT intercept or modify the command
- **THEN** Pi SHALL execute the original command with its default behavior

### Requirement: Compound commands are handled natively by rtk

The extension SHALL NOT parse or decompose compound shell commands (`&&`, `||`, pipes). The full command string SHALL be passed to `rtk rewrite` as-is, relying on `rtk` to handle sub-command analysis.

#### Scenario: Compound command with && is rewritten

- **WHEN** `rtk rewrite` receives a command like `cmd1 && cmd2`
- **THEN** `rtk` SHALL process each segment independently and return a reassembled rewritten chain, if any segment can be optimized

#### Scenario: Piped command is rewritten

- **WHEN** `rtk rewrite` receives a piped command like `cmd1 | cmd2`
- **THEN** `rtk` SHALL process the command and return a rewritten version if applicable

### Requirement: Interception uses SDK tool registration

For agent bash tool calls, the extension SHALL use `createBashTool(cwd, { spawnHook })` and register the returned tool via `pi.registerTool()`. The `spawnHook` SHALL apply `rtk rewrite` to the command before execution.

#### Scenario: Agent bash tool uses spawnHook

- **WHEN** the agent prepares to execute a bash command
- **THEN** the spawnHook SHALL receive `{ command, cwd, env }` and return a context with the command replaced by the `rtk`-rewritten version (or the original if rewrite fails)

#### Scenario: spawnHook falls back on rewrite failure

- **WHEN** `rtk rewrite` returns no result for the command
- **THEN** the spawnHook SHALL return the context with the original command unchanged
