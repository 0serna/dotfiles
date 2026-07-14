# Centralize automatic continuation

Automatic continuation is owned by an independent `auto-continue` Pi extension. It classifies Transient Failures, manages Recovery Episodes, schedules Recovery Continuations, coalesces requests, and is the only extension allowed to call `sendUserMessage("continue")` automatically.

Extensions that need continuation emit the typed `auto-continue:request` event with a supported reason. The reason selects policy centrally; callers cannot supply delays or dispatch behavior. The quota extension emits `quota-rotation` only after a successful account rotation and never dispatches the user message itself.

We rejected placing this capability in quota because transport recovery is provider-independent and does not imply quota exhaustion. We rejected placing it in model routing because recovery uses the response configuration active at dispatch and does not select a route. We also rejected a shared sending helper because multiple lifecycle owners would weaken single dispatch ownership.

Transient Failure Recovery starts only after `agent_settled` and a one-second quiet period. The delay gives route restoration and other settlement handlers a practical opportunity to finish, but it is deliberately best-effort rather than a causal ordering guarantee. At expiry, `auto-continue` rechecks runtime identity, idle state, and pending messages; any conflicting activity cancels recovery permanently. A future explicit runtime signal can replace this delay without changing the ownership or typed-event boundary.
