## MODIFIED Requirements

### Requirement: Cache event logging

The system SHALL log cache status events through the `context` extension logger at turn end and SHALL include displayed context usage plus the latest DCP pruning metrics in each cache status payload. The system SHALL NOT emit a duplicate `cache_status` log for the same final assistant response during agent end.

#### Scenario: Cache status includes hit rate

- **WHEN** cache status is logged at turn end
- **THEN** the system SHALL log `cache_status` with hit rate, input token count, cache-read token count, displayed context token count, context window size, and unavailable reason when applicable

#### Scenario: Cache status includes latest DCP metrics

- **WHEN** cache status is logged after a DCP pruning pass
- **THEN** the `cache_status` payload SHALL include `lastDcp` containing context sequence, stubbed count, estimated saved tokens, and reason counts from the latest pruning pass

#### Scenario: Cache status includes zero DCP metrics before pruning

- **WHEN** cache status is logged before any DCP pruning pass in the session
- **THEN** the `cache_status` payload SHALL include `lastDcp` with zero saved tokens and zero stubbed count

#### Scenario: Agent end does not duplicate cache status

- **WHEN** a turn has already logged `cache_status` for the latest assistant response
- **AND** the agent end lifecycle event runs without a newer assistant response
- **THEN** the system SHALL NOT log another `cache_status` event for the same response
