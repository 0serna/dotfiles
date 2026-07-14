## ADDED Requirements

### Requirement: Central automatic continuation ownership

The `auto-continue` extension SHALL be the sole owner of automatic `continue` user-message dispatch and SHALL accept typed continuation requests with centrally defined reason policies.

#### Scenario: Quota rotation requests continuation

- **WHEN** the quota extension successfully rotates to another account after confirmed quota exhaustion
- **THEN** it SHALL request automatic continuation with reason `quota-rotation`
- **AND** `auto-continue` SHALL dispatch one `continue` follow-up message immediately

#### Scenario: Caller cannot define dispatch timing

- **WHEN** another extension requests automatic continuation
- **THEN** the request SHALL identify a supported reason
- **AND** the caller SHALL NOT supply its own delay or dispatch policy

#### Scenario: Concurrent requests are coalesced

- **WHEN** more than one eligible continuation request is pending before dispatch
- **THEN** `auto-continue` SHALL dispatch at most one `continue` user message

#### Scenario: Immediate request supersedes transient timer

- **WHEN** a `quota-rotation` request arrives while a transient recovery timer is pending
- **THEN** `auto-continue` SHALL cancel the transient timer
- **AND** SHALL dispatch one immediate continuation

### Requirement: Provider-agnostic transient failure classification

The system SHALL classify transient assistant failures independently of provider identity using a conservative, case-insensitive set of explicit signals: `fetch failed`, `WebSocket error`, `Connection error`, `Request timed out`, `Streaming response failed`, `Stream ended without finish_reason`, and `You can retry your request`.

#### Scenario: Codex fetch failure is eligible

- **WHEN** an assistant message from `openai-codex` ends with `stopReason: "error"` and error text containing `fetch failed`
- **THEN** the system SHALL classify the outcome as a transient failure

#### Scenario: Retry declaration is eligible without provider prefix matching

- **WHEN** any provider returns an assistant error containing `You can retry your request`
- **THEN** the system SHALL classify the outcome as a transient failure

#### Scenario: Broad provider error remains ineligible

- **WHEN** an assistant error contains only a provider error prefix such as `Codex error` without an explicit transient signal
- **THEN** the system SHALL NOT classify the outcome as transient

#### Scenario: Generic status codes remain ineligible

- **WHEN** an assistant error contains HTTP 429 or a generic 5xx status without an explicit transient signal
- **THEN** the system SHALL NOT classify the outcome as transient

#### Scenario: Classification ignores provider identity

- **WHEN** two providers return the same explicitly supported transient signal
- **THEN** the system SHALL classify both outcomes identically

### Requirement: Terminal outcome controls transient recovery

The system SHALL base transient recovery only on the last assistant outcome observed before Pi settles.

#### Scenario: Pi recovers after an earlier transient failure

- **WHEN** a transient assistant error is followed by a non-error assistant outcome before `agent_settled`
- **THEN** the system SHALL clear the pending transient candidate
- **AND** SHALL NOT schedule a recovery continuation

#### Scenario: Permanent error replaces transient failure

- **WHEN** a transient assistant error is followed by an assistant error that is not classified as transient before `agent_settled`
- **THEN** the system SHALL NOT schedule transient recovery

#### Scenario: Terminal transient failure remains eligible

- **WHEN** the last assistant outcome before `agent_settled` is classified as transient
- **THEN** the system SHALL make that outcome eligible for one recovery episode

### Requirement: Quiet-period recovery dispatch

The system SHALL schedule transient failure recovery only after Pi emits `agent_settled`, wait one second, and dispatch only if the runtime remains quiet and valid.

#### Scenario: Unrecovered transient failure stays quiet

- **WHEN** the terminal assistant outcome is transient
- **AND** Pi emits `agent_settled`
- **AND** the same session runtime remains active, idle, without pending messages or later assistant outcomes for one second
- **THEN** `auto-continue` SHALL dispatch one `continue` follow-up message

#### Scenario: User activity cancels recovery

- **WHEN** user or agent activity begins during the one-second quiet period
- **THEN** `auto-continue` SHALL cancel that recovery permanently
- **AND** SHALL NOT reschedule it at the next idle boundary

#### Scenario: Pending message cancels recovery

- **WHEN** the quiet-period timer expires while Pi has pending messages
- **THEN** `auto-continue` SHALL cancel the recovery without dispatch

#### Scenario: Recovery uses current response configuration

- **WHEN** the active model or thinking level changes between the transient failure and continuation dispatch
- **THEN** the recovery continuation SHALL use the response configuration active at dispatch time
- **AND** SHALL NOT restore the provider or model that failed

### Requirement: Bounded recovery episode

The system SHALL issue at most one Recovery Continuation in a Recovery Episode and SHALL prevent a transient failure from that continuation from recursively opening another recovery continuation.

#### Scenario: Recovery continuation fails transiently

- **WHEN** a Recovery Continuation ends with another classified transient failure
- **THEN** the system SHALL close the Recovery Episode
- **AND** SHALL NOT dispatch another continuation for that outcome

#### Scenario: Independent later work can recover

- **WHEN** a Recovery Episode has closed
- **AND** a later independently initiated prompt or quota-rotation continuation ends with an eligible transient failure
- **THEN** the system MAY open a new Recovery Episode

#### Scenario: Quota and transient budgets remain independent

- **WHEN** quota rotation requests an automatic continuation
- **THEN** that request SHALL NOT consume a transient recovery continuation merely because both use the same dispatcher

### Requirement: Runtime-local lifecycle and structured observability

The system SHALL keep automatic continuation state local to the active session runtime, cancel pending work during shutdown, and log recovery decisions without routine recovery notifications.

#### Scenario: Session runtime shuts down with pending recovery

- **WHEN** Pi emits `session_shutdown` while a continuation timer or request is pending
- **THEN** `auto-continue` SHALL cancel the pending work
- **AND** a replacement or resumed session SHALL NOT revive it

#### Scenario: Recovery decisions are logged

- **WHEN** a continuation is requested, scheduled, cancelled, dispatched, or suppressed
- **THEN** the system SHALL write a structured `auto-continue` log event containing the reason or classified signal and relevant origin/dispatch attribution
- **AND** SHALL NOT log the complete provider error message

#### Scenario: Transient recovery is silent

- **WHEN** transient recovery is scheduled, cancelled, dispatched, or suppressed
- **THEN** the system SHALL NOT display a recovery UI notification
