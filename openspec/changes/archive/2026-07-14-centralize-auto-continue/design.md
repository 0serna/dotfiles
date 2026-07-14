## Context

The quota extension currently combines two policies: OpenCode Go account rotation after provider-confirmed quota exhaustion and a one-shot continuation after selected streaming failures. Its provider guard prevents the latter from handling Codex failures such as `fetch failed`, `WebSocket error`, and server messages that explicitly invite retry. The same entrypoint also owns the actual `sendUserMessage("continue")` call.

Pi emits `agent_settled` only after its own retry, compaction recovery, and queued follow-ups are exhausted. Multiple extension handlers run sequentially, but relying on discovery order to place recovery after model-route restoration would be fragile. The accepted design instead uses a one-second best-effort quiet period before transient recovery; this reduces coordination races but does not guarantee that every unrelated asynchronous activity has completed.

## Goals / Non-Goals

**Goals:**

- Make transient failure recovery available to every model provider through one conservative classifier.
- Give one extension sole ownership of automatic `continue` delivery.
- Keep quota rotation and transient recovery as separate policies with independent budgets.
- Prevent recursive recovery loops and stale continuation injection.
- Preserve the response configuration active when recovery is dispatched.
- Make continuation decisions auditable without adding routine UI noise.

**Non-Goals:**

- Retry every provider error or infer retryability from broad provider prefixes or HTTP status codes.
- Replay an identical provider request or force the provider/model that failed.
- Guarantee causal ordering with every extension through the one-second delay.
- Persist pending recovery across session runtime replacement.
- Change Pi's built-in retry behavior, quota observation, account selection, or model-routing rules.

## Decisions

### Introduce an independent `auto-continue` extension

`auto-continue` owns classification, scheduling, coalescing, and every automatic `pi.sendUserMessage("continue", { deliverAs: "followUp" })` call. The quota extension retains quota detection, account state, rotation, and user notifications, then emits a typed request after successful rotation.

This boundary was chosen over placing recovery in quota because transport failures do not imply quota exhaustion, and over placing it in model-routing because recovery does not select response configuration. A shared helper called by quota was rejected because it would leave a provider-general capability lifecycle-coupled to quota.

### Use a typed event request contract

Callers emit an internal `auto-continue:request` event with a supported reason. Initially the external reason is `quota-rotation`; transient failures enter the same internal request pipeline as `transient-failure`. Callers cannot choose arbitrary delays or dispatch behavior.

Reason policy is centralized:

- `quota-rotation`: dispatch immediately after successful account rotation.
- `transient-failure`: wait for terminal settlement and then a one-second quiet period.

Pending requests are coalesced so only one user message is sent. An immediate quota request supersedes and cancels a pending transient timer. Quota remains responsible for deciding whether rotation is allowed, so continuation dispatch does not merge quota and recovery budgets.

A fallback direct send from quota was rejected because it would violate single ownership and make behavior depend on whether the central extension happened to be available.

### Classify transient failures by explicit provider-neutral signals

The classifier is case-insensitive and recognizes only these initial message signals:

- `fetch failed`
- `WebSocket error`
- `Connection error`
- `Request timed out`
- `Streaming response failed`
- `Stream ended without finish_reason`
- `You can retry your request`

It does not classify broad prefixes such as `Codex error`, provider names, isolated `retry`, HTTP 429, or generic 5xx codes. New signals can be added centrally with focused tests without adding provider branches.

The state machine tracks the last assistant outcome before settlement. A later successful, non-error, or permanent-error assistant outcome replaces an earlier transient candidate, preventing recovery after Pi has already recovered or reached a different terminal result.

### Recover only after settlement and a cancellable quiet period

For an eligible terminal transient failure, `agent_settled` schedules a one-second timer. At expiry the extension sends a continuation only if:

- the originating session runtime is still active;
- Pi remains idle;
- Pi has no pending messages;
- no later assistant outcome or other activity invalidated the candidate.

If any condition fails, recovery is cancelled permanently rather than rescheduled. The delay is deliberately best-effort instead of a model-routing completion signal. It allows route restoration normally to finish first, but the continuation always uses whichever model and thinking level are active at dispatch time.

### Bound recovery with a recovery episode

A recovery episode starts from one eligible transient terminal outcome and includes at most one recovery continuation plus its terminal outcome, even though the one-second delay crosses an observable idle boundary. If that continuation also ends transiently, the episode closes without another continuation. A later independently initiated prompt or quota-rotation continuation can open a new episode.

This episode state is distinct from quota's attempted-account cycle. A quota continuation does not consume the transient recovery budget merely because both use the same dispatcher.

### Keep state runtime-local and recovery silent

Timers, pending requests, terminal outcome metadata, and episode state live only in the current extension runtime. `session_shutdown` cancels timers and clears all state; reload, resume, fork, and session replacement do not revive pending work.

The extension uses the shared logger under `auto-continue` and records request, schedule, cancellation, dispatch, and suppression events. Logs include classified signal/reason plus origin and dispatch model attribution, but not the complete provider error. Transient recovery does not notify the UI; quota keeps its existing rotation and exhaustion notifications.

### Record the architectural boundary

An ADR will document the independent extension, single dispatch ownership, typed request seam, alternatives rejected, and the explicit limitation of the one-second best-effort delay.

## Risks / Trade-offs

- **[The one-second delay does not guarantee route restoration has completed]** → Recheck idle/pending state, use the configuration active at dispatch, document best-effort semantics, and keep the design replaceable by a future causal signal.
- **[Conservative signatures miss new transient provider errors]** → Log unclassified terminal failures through existing provider/session diagnostics and add explicit tested signals as evidence appears.
- **[A broad text signal can misclassify an unusual permanent error]** → Avoid provider prefixes and generic status codes, bound intervention to one continuation, and never mutate quota or credentials from recovery.
- **[Event contract creates an extension dependency]** → Keep the payload small and typed, load both extensions from the same managed dotfiles set, and fail without a direct-send fallback so ownership remains unambiguous.
- **[A visible `continue` user message is not an identical retry]** → Name it Recovery Continuation, preserve current routing rather than failed routing, and document that it resumes context rather than replaying transport.

## Migration Plan

1. Add the `auto-continue` extension, classifier, state machine, typed event contract, logging, and focused tests.
2. Change quota to emit `quota-rotation` requests after successful rotation and remove its transient-recovery state and direct continuation calls.
3. Update quota tests and add cross-extension contract coverage.
4. Add the ADR and reconcile living specifications when the change is archived.
5. Roll back by restoring quota's previous direct continuation behavior and removing the new extension; no persisted data migration is required.

## Open Questions

None.
