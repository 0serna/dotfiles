# Spec Delta

## Purpose

Give the user a visible, per-turn context usage signal so they decide when to compact, without relying on native UI that T3 Code does not render.

## ADDED Requirements

### Requirement: Final answers report context usage

When a model request ends with a `status: <tokens>` note, the agent SHALL end its final answer of that turn with a single `context: <n>k` line, where `n` is `<tokens>` divided by 1000 and rounded to the nearest integer.

#### Scenario: Completed turn ends with the line

- **WHEN** the model receives `status: 271384` and completes the turn without further tool calls
- **THEN** the final answer ends with `context: 271k` as its own line

#### Scenario: Intermediate turns stay clean

- **WHEN** a request carries a status note but the model still has tool calls to make
- **THEN** no context line appears in that intermediate assistant message

#### Scenario: Failed turns have no line

- **WHEN** the turn ends in an error or cancellation
- **THEN** the final output has no context line

#### Scenario: Missing note

- **WHEN** no status note is present, as with Codex
- **THEN** the agent does not invent a context line

### Requirement: Both harnesses inject a request-local status note

Pi and OpenCode SHALL append a `status: <tokens>` message as the last message of each primary model request when usage is known, and SHALL keep it out of the persisted session history.

#### Scenario: Pi uses current context usage

- **WHEN** Pi builds a primary request and `ctx.getContextUsage()` returns 271384 tokens
- **THEN** the last request message is `status: 271384`, and the session transcript does not contain it afterward

#### Scenario: OpenCode uses the last completed step

- **WHEN** OpenCode builds a request after a step closed with token usage totalling 271384
- **THEN** the last request message is `status: 271384`

#### Scenario: Unknown usage carries no note

- **WHEN** usage is unknown right after compaction, or no step has completed yet
- **THEN** the request carries no status note

### Requirement: Compaction never reports stale usage

The harness adapters SHALL omit the status note while a compaction request runs and SHALL discard recorded usage when a compaction starts, so no pre-compaction number reaches the model after compaction.

#### Scenario: Pi skips the note during compaction

- **WHEN** Pi summarizes a session to compact it
- **THEN** the summarization request carries no status note

#### Scenario: OpenCode resets usage on compaction

- **WHEN** OpenCode emits `session.compaction.started` for a session
- **THEN** the next primary request carries no status note until a new step completes

### Requirement: Native compaction thresholds remain the safety net

The change SHALL NOT configure a fixed 300k-token compaction threshold in Pi or OpenCode; auto-compaction stays enabled at each harness's native threshold and the context line drives manual compaction.

#### Scenario: No threshold override

- **WHEN** reading `dotfiles/pi/settings.json` and `dotfiles/opencode/opencode.jsonc`
- **THEN** neither config sets a 300000-token compaction limit
