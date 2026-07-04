## ADDED Requirements

### Requirement: Stable pruning interface

DCP SHALL expose context pruning behavior through a single stable pruning interface that accepts the current context messages and pruning options, returns transformed messages and metrics, and preserves all existing pruning-rule behavior behind that interface. If pruning encounters an unexpected internal error, DCP SHALL leave the input messages unchanged and SHALL return empty pruning metrics rather than interrupting context processing.

#### Scenario: Pruning succeeds through stable interface

- **WHEN** context messages are passed through the pruning interface
- **THEN** DCP SHALL return a messages array and pruning metrics according to the existing pruning rules

#### Scenario: Internal pruning failure is fail-open

- **WHEN** an unexpected internal pruning error occurs while processing context messages
- **THEN** DCP SHALL return the original messages unchanged
- **AND** DCP SHALL return empty pruning metrics
