## 1. Recovery Contract and Pure Logic

- [x] 1.1 Add failing focused tests for case-insensitive transient signal classification, permanent-error exclusions, and provider-independent outcomes.
- [x] 1.2 Implement the conservative transient failure classifier and typed continuation reason/request contract.
- [x] 1.3 Add failing state-machine tests for terminal-outcome replacement, one-continuation Recovery Episodes, and independently initiated later work.
- [x] 1.4 Implement the pure recovery episode and pending-request state transitions needed by the extension lifecycle.

## 2. Auto-Continue Extension

- [x] 2.1 Add failing extension tests for `agent_settled`, the one-second quiet period, current-routing dispatch, user/pending-message cancellation, and session shutdown cleanup.
- [x] 2.2 Implement `dotfiles/pi/agent/extensions/auto-continue/` with runtime-local state, cancellable timers, and the sole `sendUserMessage("continue")` dispatch path.
- [x] 2.3 Add failing tests for typed quota requests, immediate dispatch, request coalescence, and quota precedence over a pending transient timer.
- [x] 2.4 Implement the `auto-continue:request` event consumer and centralized reason policies.
- [x] 2.5 Add structured `auto-continue` logging for requested, scheduled, cancelled, sent, and suppressed decisions without logging complete provider errors or showing recovery notifications.

## 3. Quota Integration

- [x] 3.1 Update quota tests first to require a typed `quota-rotation` request after successful rotation and prohibit direct automatic user-message dispatch.
- [x] 3.2 Remove transient classification, recovery timers/flags, and `agent_settled` recovery behavior from the quota extension while preserving quota account-cycle state and notifications.
- [x] 3.3 Emit the central continuation request only after successful account rotation and verify exhaustion or failed rotation emits no request.
- [x] 3.4 Remove obsolete quota transient-retry helpers and tests, retaining quota-exhaustion classification and rotation coverage.

## 4. Architecture Record and Verification

- [x] 4.1 Add an ADR documenting the independent `auto-continue` boundary, single dispatch ownership, typed event seam, rejected quota/model-routing placement, and the best-effort one-second delay trade-off.
- [x] 4.2 Verify `CONTEXT.md` consistently uses Transient Failure, Transient Failure Recovery, Recovery Episode, and Recovery Continuation terminology.
- [x] 4.3 Run focused Vitest suites for `auto-continue` and quota, then run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format`, and `npm run openspec`; fix every finding caused by the change.
