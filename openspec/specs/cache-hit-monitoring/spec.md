## Purpose

The cache hit monitoring capability defines how the context-usage extension computes, displays, colors, and logs cache hit rate information in the pi status bar.

## Requirements

### Requirement: Cache hit rate computation

The system SHALL compute the cache hit rate from the latest assistant message usage data. The hit rate SHALL be `cacheRead / (cacheRead + input)` expressed as an integer percentage (0-100). When no assistant messages with usage exist in the session branch, the hit rate SHALL be reported as 0%. When `cacheRead + input === 0`, the hit rate SHALL be reported as 0%.

#### Scenario: Normal cache hit rate

- **WHEN** the latest assistant message has `input: 100` and `cacheRead: 900`
- **THEN** the computed hit rate SHALL be `90`

#### Scenario: Zero tokens exchanged

- **WHEN** the latest assistant message has `input: 0` and `cacheRead: 0`
- **THEN** the computed hit rate SHALL be `0`

#### Scenario: No assistant messages yet

- **WHEN** the session branch contains no assistant messages with usage data
- **THEN** the computed hit rate SHALL be `0`

### Requirement: Cache hit rate display format

The system SHALL display context usage, latest DCP estimated token savings, and cache hit rate in the status bar in the order `ctx <tokens> saved <Xk> cache N%`. The cache hit rate display color SHALL be `warning` when the latest two assistant responses with usage are below 80%, and `dim` otherwise. The `ctx` and `saved` segments SHALL always be displayed using integer k-format and the `saved` segment SHALL use dim color.

#### Scenario: Below threshold

- **WHEN** the cache hit rate is `65`
- **THEN** the status bar SHALL show `cache 65%` with `warning` color

#### Scenario: At threshold

- **WHEN** the cache hit rate is `80`
- **THEN** the status bar SHALL show `cache 80%` with `dim` color

#### Scenario: Above threshold

- **WHEN** the cache hit rate is `95`
- **THEN** the status bar SHALL show `cache 95%` with `dim` color

#### Scenario: No cache data (display)

- **WHEN** no cache hit rate can be computed
- **THEN** the status bar SHALL show `cache 0%` with `warning` color

#### Scenario: Latest DCP savings displayed

- **WHEN** the latest DCP pruning pass estimated `900` saved tokens
- **THEN** the status bar SHALL include `saved 1k` between the context usage and cache segments
- **AND** the saved segment SHALL use `dim` color

#### Scenario: Zero DCP savings displayed

- **WHEN** the latest DCP pruning pass estimated `0` saved tokens
- **THEN** the status bar SHALL include `saved 0k` between the context usage and cache segments
- **AND** the saved segment SHALL use `dim` color

### Requirement: Cache event logging

The system SHALL log cache status events through the `context` extension logger and SHALL include displayed context usage plus the latest DCP pruning metrics in each cache status payload.

#### Scenario: Cache status includes hit rate

- **WHEN** cache status is logged
- **THEN** the system SHALL log `cache_status` with hit rate, input token count, cache-read token count, displayed context token count, context window size, and unavailable reason when applicable

#### Scenario: Cache status includes latest DCP metrics

- **WHEN** cache status is logged after a DCP pruning pass
- **THEN** the `cache_status` payload SHALL include `lastDcp` containing context sequence, stubbed count, estimated saved tokens, and reason counts from the latest pruning pass

#### Scenario: Cache status includes zero DCP metrics before pruning

- **WHEN** cache status is logged before any DCP pruning pass in the session
- **THEN** the `cache_status` payload SHALL include `lastDcp` with zero saved tokens and zero stubbed count
