## ADDED Requirements

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

The system SHALL display the cache hit rate in the status bar as `cache N%` where N is the integer percentage. The display color SHALL be `mdHeading` when the hit rate is below 80%, and `dim` when it is 80% or above.

#### Scenario: Below threshold

- **WHEN** the cache hit rate is `65`
- **THEN** the status bar SHALL show `cache 65%` with `mdHeading` color

#### Scenario: At threshold

- **WHEN** the cache hit rate is `80`
- **THEN** the status bar SHALL show `cache 80%` with `dim` color

#### Scenario: Above threshold

- **WHEN** the cache hit rate is `95`
- **THEN** the status bar SHALL show `cache 95%` with `dim` color

#### Scenario: No cache data (display)

- **WHEN** no cache hit rate can be computed
- **THEN** the status bar SHALL show `cache 0%` with `mdHeading` color

### Requirement: Cache event logging

The system SHALL log cache-related events at the `agent_end` lifecycle event. Two event types SHALL be logged:

- `cache_below_threshold`: when the hit rate is below 80%, logged with the current hit rate value
- `cache_unavailable`: when the hit rate cannot be computed, logged with a reason string

The reason SHALL be one of `no_assistant_messages`, `no_cache_reads`, or `zero_denominator`.

#### Scenario: Log cache below threshold

- **WHEN** the cache hit rate is `65` at `agent_end`
- **THEN** the system SHALL log `cache_below_threshold` with `hitRate: 65` and `threshold: 80`

#### Scenario: Log cache unavailable (no assistant messages)

- **WHEN** the session branch contains no assistant messages and `agent_end` fires
- **THEN** the system SHALL log `cache_unavailable` with `reason: "no_assistant_messages"`

#### Scenario: Log cache unavailable (no cache reads)

- **WHEN** assistant messages exist but none report `cacheRead > 0`
- **THEN** the system SHALL log `cache_unavailable` with `reason: "no_cache_reads"`

#### Scenario: Log cache unavailable (zero denominator)

- **WHEN** the latest assistant message has `input: 0` and `cacheRead: 0`
- **THEN** the system SHALL log `cache_unavailable` with `reason: "zero_denominator"`
