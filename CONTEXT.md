# Dotfiles

This context covers the local automation and Pi agent extensions managed by this dotfiles repository.

## Language

**Check output contract**:
The machine-readable format used by quality check scripts. Uses `---CHECK:<tool>---` delimiters for failed tool output and `---CHECK:SUMMARY---` for the final status report. Each tool appears as `tool: PASS` or `tool: FAIL`.
_Avoid_: verbose output, extra delimiters

**Web research surface**:
One of the read-only external research capabilities available to the agent: discovering web sources, reading a known URL, finding public source-code usage, or consulting library documentation. Each surface represents a distinct research intent rather than a provider.
_Avoid_: web tool, research provider, Ketch command

**Context pruning**:
Reduction of transient tool-result content before it is sent back into the Pi agent context. It preserves the useful record of what happened while replacing low-value large output with compact stubs.
_Avoid_: DCP internals, context cleanup, pruning helper

**Agent attempt**:
A single uninterrupted pass of the agent loop. It may finish while automatic recovery or queued work still remains.
_Avoid_: agent run, completed work, processing cycle

**Processing cycle**:
A contiguous period of agent work that includes its attempts, automatic retries, compaction recovery, queued continuations, and extension-started work that prevents an idle boundary. It finishes only when Pi is observably idle.
_Avoid_: agent run, attempt, model request

**Processing cycle duration**:
The wall-clock time from the beginning of a processing cycle until it fully finishes. It includes model generation, tool execution, retry backoff, compaction recovery, and waits between attempts.
_Avoid_: active compute time, attempt duration, request latency

**Route segment**:
A contiguous portion of a processing cycle governed by one declared model and thinking-level route. It starts when its routed message begins processing and ends when another route begins, a manual model or thinking-level selection cancels it, or the cycle finishes; unrouted continuations inherit the active segment.
_Avoid_: routed prompt, temporary model, routed processing cycle

**Session manual selection**:
The model and thinking-level pair owned by one Pi session runtime. It initializes from the latest persisted manual selection at session start, changes with that session's manual selections, and remains isolated from later selections published by other active sessions.
_Avoid_: global selection, default model, persisted selection

**Latest persisted manual selection**:
The model and thinking-level pair most recently published to shared manual preferences. It supplies the startup default for future session runtimes but does not replace the session manual selection of an active runtime.
_Avoid_: session selection, active model, global default

**Route restoration**:
The return from a routed selection to the session manual selection after routed work finishes. It remains pending while Pi is busy; once idle, an unavailable selection closes the route while retaining the active model and warning the user.
_Avoid_: route deactivation, default model reset, model fallback

**Assistant response configuration**:
The selected model and thinking level committed to one assistant response. It becomes fixed when that response begins; later selections apply only to a subsequent response—including retries and post-tool continuations—while the last responding model records actual attribution.
_Avoid_: hot-swapped model, live model switch

**Completion marker**:
The `✓` shown when a processing cycle finishes, regardless of whether its final outcome succeeded, failed, or was aborted. It communicates settlement, not success.
_Avoid_: success indicator, pass result, outcome status

**Last responding model**:
The model associated with the most recent assistant response in a processing cycle, even when that response produced no output deltas. If no assistant response exists, attribution falls back to the model active when the cycle began; idle restoration does not change it.
_Avoid_: selected model, restored model, last producing model

**Output total throughput**:
The model output generation rate measured as output tokens per second for one assistant stream. It counts the provider-reported total output, including visible text, reasoning/thinking output, and tool-call output when those are part of output usage.
_Avoid_: latency, request duration, visible text speed

**Live throughput**:
A medium-precision output total throughput estimate shown while an assistant stream is actively generating. It is derived from streamed deltas and is superseded by final throughput when the stream closes.
_Avoid_: exact live tokens, final speed

**Final throughput**:
A high-precision output total throughput value shown after an assistant stream closes. It uses the provider-reported output token count for the stream.
_Avoid_: estimated speed, prompt throughput

**Last final throughput**:
The most recent valid final throughput retained within a processing cycle, including across tool execution and later attempts without usable output metrics.
_Avoid_: live speed, cycle average, session statistic

**Exhausted quota window**:
A quota window whose remaining allowance is exactly zero. Compact quota status represents an active source with any exhausted window as `0%` using the same shape as a healthy source.
_Avoid_: empty quota, blocked provider

**Spendable quota balance**:
Paid credits or dollar balance available after an exhausted quota window starts consuming fallback allowance. It is shown in `/quota` detail only, where a known zero remains distinct from an unknown value.
_Avoid_: credit line, quota percent

**Banked reset**:
A Codex reset credit that can restore quota before its expiry. Compact Codex status always shows the known count as `R<n>` and uses `R?` when reset-credit data is unavailable; `R0` means a confirmed empty set.
_Avoid_: reset timer, quota window

**Account selection**:
The process that evaluates OpenCode Go account observations from the aggregated quota snapshot and picks the account with the most balanced remaining quota across all windows. It does not wait for network refreshes, reevaluates an initial blind fallback when the first usable snapshot arrives, and otherwise reselects only when the active account is no longer usable; preventive reselection is applied only while the Pi runtime is fully idle.
_Avoid_: account picker, provider selection

**Quota window**:
A time-bound usage allowance — rolling, weekly, or monthly — with a remaining percentage and a reset time. An account is ineligible for selection if any of its windows reaches zero.
_Avoid_: rate limit window, usage bucket, allowance period

**Quota source**:
An independently fetchable quota target declared for a provider, such as the Codex login or one OpenCode Go account. Freshness and failures are tracked per source even when required credentials are absent.
_Avoid_: provider, credential, quota account

**Quota source identity**:
The stable, non-secret identity that binds an observation to its declared provider source. A configuration or account identity change invalidates retained observations, and removed declarations remove their sources from the snapshot.
_Avoid_: account label, credential value, display name

**Quota configuration conflict**:
A mismatch in the declared source identity or required quota configuration between concurrent Pi processes. The conflict is reported without allowing one process's missing configuration to overwrite a valid shared observation.
_Avoid_: provider failure, unavailable source, credential value

**Unavailable quota source**:
A declared quota source that cannot be fetched because required configuration or authentication is absent. It remains visible in the aggregated snapshot with the reason it is unavailable.
_Avoid_: undeclared provider, degraded source, fetch failure

**Active quota source**:
The source chosen by one Pi runtime to represent and supply a provider, independent of whether that provider's model is currently selected. It is not shared across Pi processes; compact status shows the local active source, while `/quota` shows every declared source.
_Avoid_: active model, global source, shared account

**Compact quota status**:
A single-line footer summary of every active quota source, showing the most constrained window's remaining percentage, banked reset count when known, and a visual prefix for degraded or error states. Spendable balances and reset times are excluded; the `/quota` command provides full detail.
_Avoid_: quota detail, provider status, live quota

**Aggregated quota snapshot**:
A user-scoped view containing the latest quota observation for every configured quota source. Concurrent Pi processes share the same snapshot.
_Avoid_: process status, provider cache, session snapshot

**Quota detail**:
The `/quota` read-only projection of every declared source in the aggregated quota snapshot. It returns immediately, even during a refresh, and each source includes available quota values plus its current state, observation age, and a summarized failure reason when applicable.
_Avoid_: compact quota status, fresh fetch, quota logs

**Quota refresh**:
The single authoritative operation that fetches every configured quota source and produces an aggregated quota snapshot. Session startup and the periodic schedule request this operation; `/quota` only reads the latest snapshot.
_Avoid_: provider polling, status fetch, individual refresh

**Degraded quota source**:
A configured quota source whose latest refresh attempt failed while its last successful observation remains available. For up to 30 minutes after its last successful refresh, the retained observation stays visible with a failure indication and remains eligible for account selection.
_Avoid_: failed snapshot, missing provider, invalid quota

**Expired quota observation**:
A retained provider observation whose last successful refresh is more than 30 minutes old. It is no longer presented as usable quota; the provider is shown as an error instead.
_Avoid_: degraded source, zero quota, exhausted window

**Provider-confirmed quota exhaustion**:
Shared evidence from an explicit runtime quota error that a quota source is not currently usable, even when its previous dashboard observation reported remaining allowance. The next positive dashboard observation restores global eligibility without making an already-attempted account eligible again within the current processing cycle.
_Avoid_: account cooldown, inferred zero percent, dashboard failure

**Account cooldown**:
A temporary, Pi-runtime-local ban applied to an account after a rate-limit or authorization error, preventing it from being selected again until the cooldown expires. Cooldowns are not part of the shared quota snapshot.
_Avoid_: global account lockout, penalty period, refresh backoff

**Blind fallback**:
Activating the first configured OpenCode Go account without a usable quota observation, including when no shared snapshot exists at session start. It is reevaluated when the first usable snapshot arrives and still relies on runtime rotation if exhausted.
_Avoid_: default account, emergency fallback, unverified activation

**Transient failure**:
A terminal assistant outcome explicitly classified as temporary after Pi has exhausted its own automatic recovery. It is independent of provider identity and does not imply quota exhaustion.
_Avoid_: quota exhaustion, permanent failure, any provider error

**Transient failure recovery**:
The best-effort policy that may issue one Recovery Continuation within a Recovery Episode after a Transient Failure. It does not rotate quota sources, apply cooldown, or alter the aggregated quota snapshot.
_Avoid_: transient stream retry, quota rotation, provider retry

**Recovery episode**:
The bounded recovery interval that starts with an eligible Transient Failure and includes at most one Recovery Continuation plus its terminal outcome, even when a brief idle boundary exists between them. A transient failure from that continuation closes the episode without another continuation.
_Avoid_: processing cycle, retry loop, quota rotation cycle

**Recovery continuation**:
An automatic `continue` message issued after Pi settles and a one-second quiet period. It uses the response configuration then in effect and is cancelled when new activity appears, so it does not guarantee replaying the same request, account, provider, or model.
_Avoid_: request retry, model retry, delayed user prompt
