# pi-dcp-lite-context-pruning Specification

## Purpose

TBD - created by archiving change add-dcp-lite-extension. Update Purpose after archive.

## Requirements

### Requirement: Invisible automatic context pruning

DCP SHALL run automatically during Pi context construction without registering model-callable tools, user commands, prompt instructions, or user-facing notifications.

#### Scenario: Context event applies DCP without interaction

- **WHEN** Pi prepares messages for a model request
- **THEN** DCP SHALL evaluate the context automatically without requiring user or model action

#### Scenario: DCP does not add model-facing affordances

- **WHEN** DCP is loaded
- **THEN** it SHALL NOT register custom tools, commands, system prompt additions, nudges, or model instructions

### Requirement: Non-destructive transient pruning

DCP SHALL only modify the transient message list returned from the `context` event and SHALL NOT mutate saved session entries or trigger session compaction.

#### Scenario: Session history remains unchanged

- **WHEN** DCP replaces a stale tool result in the context sent to the model
- **THEN** the original saved session entry SHALL remain unchanged

#### Scenario: DCP does not compact sessions

- **WHEN** context size grows during a session
- **THEN** DCP SHALL NOT trigger Pi compaction automatically

### Requirement: Tool-result-only stubbing

DCP SHALL reduce stale context by replacing eligible `toolResult` content with an informational stub and SHALL NOT modify user messages or assistant messages.

#### Scenario: Eligible tool result is stubbed

- **WHEN** a non-recent `toolResult` is eligible for pruning
- **THEN** DCP SHALL replace its content with a stub containing the pruning reason, tool name, and truncated target

#### Scenario: User and assistant messages are preserved

- **WHEN** DCP evaluates context messages
- **THEN** it SHALL leave all user messages and assistant messages unchanged

### Requirement: Recent message protection

DCP SHALL preserve the last 20 messages in the context without stubbing them.

#### Scenario: Recent stale output is protected

- **WHEN** an otherwise eligible `toolResult` is within the last 20 messages
- **THEN** DCP SHALL leave that message unchanged

### Requirement: Balance-oriented pruning rules

DCP SHALL stub only non-recent `toolResult` messages that match deterministic stale-output rules: duplicate output, resolved error, superseded file operation, or old large command/listing output over a 2000-token estimate.

#### Scenario: Duplicate output is stubbed

- **WHEN** a non-recent `toolResult` has the same normalized content as an earlier kept tool result
- **THEN** DCP SHALL replace the duplicate result content with an informational stub

#### Scenario: Resolved error is stubbed

- **WHEN** a non-recent error `toolResult` is followed by a later successful result for the same operation
- **THEN** DCP SHALL replace the error result content with an informational stub

#### Scenario: Superseded file result is stubbed

- **WHEN** a non-recent read, write, or edit `toolResult` targets a file that is targeted by a later read, write, or edit operation
- **THEN** DCP SHALL replace the older result content with an informational stub

#### Scenario: Old large command output is stubbed

- **WHEN** a non-recent command, listing, or search `toolResult` has an estimated size greater than 2000 tokens
- **THEN** DCP SHALL replace the result content with an informational stub

### Requirement: Fail-open safety

DCP SHALL return the original context unchanged if pruning cannot be completed safely and SHALL log a structured prune error through the context extension logger.

#### Scenario: Pruning error preserves original context

- **WHEN** DCP encounters an unexpected error while evaluating or stubbing messages
- **THEN** it SHALL return the original message list unchanged
- **AND** it SHALL write a `context_prune_error` log entry to the `context` extension log

#### Scenario: Unknown message shape is not pruned

- **WHEN** DCP cannot confidently identify a message's tool metadata or content shape
- **THEN** it SHALL leave that message unchanged

### Requirement: Structured DCP logging

DCP SHALL use the repository shared extension logger with extension name `context` and SHALL log summary metrics plus truncated targets without logging full tool output content.

#### Scenario: Pruning activity is logged

- **WHEN** DCP stubs one or more tool results during context construction
- **THEN** it SHALL write a structured `context_pruned` log entry containing processed count, stubbed count, protected recent count, reason counts, estimated saved tokens, and truncated target metadata
- **AND** the entry SHALL be written to the `context` extension log

#### Scenario: Baseline pruning pass is logged

- **WHEN** DCP evaluates context messages and stubs no tool results
- **THEN** it SHALL write a structured `context_pruned` log entry with zero stubbed count and zero estimated saved tokens
- **AND** the entry SHALL be written to the `context` extension log

#### Scenario: Full output content is excluded from logs

- **WHEN** DCP logs pruning decisions
- **THEN** it SHALL NOT include the original full tool result content in the log entry

### Requirement: Context extension ownership

DCP SHALL be implemented as part of the `context` Pi extension and SHALL NOT exist as a separate runtime extension directory.

#### Scenario: Context extension registers pruning

- **WHEN** Pi loads the managed context extension
- **THEN** the context extension SHALL register the automatic context pruning handler
- **AND** no standalone `dcp` extension directory SHALL be required

#### Scenario: DCP remains non-interactive after merge

- **WHEN** DCP is owned by the context extension
- **THEN** it SHALL NOT register custom tools, commands, prompt instructions, nudges, or model-facing affordances

### Requirement: Latest DCP metrics for context status

The context extension SHALL retain the latest DCP pruning metrics for the active session so status rendering and cache logging can reference the most recent pruning outcome.

#### Scenario: Latest prune metrics are recorded

- **WHEN** context pruning completes for a model request
- **THEN** the context extension SHALL record the latest context sequence, stubbed count, estimated saved tokens, and reason counts

#### Scenario: Latest prune metrics reset on session start

- **WHEN** a new Pi session starts
- **THEN** the latest DCP metrics SHALL reset to zero saved tokens and no stubs
