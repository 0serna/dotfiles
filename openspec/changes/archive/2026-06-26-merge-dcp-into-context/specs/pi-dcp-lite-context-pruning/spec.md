## ADDED Requirements

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

## MODIFIED Requirements

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
