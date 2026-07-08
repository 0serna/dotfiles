# Dotfiles

This context covers the local automation and Pi agent extensions managed by this dotfiles repository.

## Language

**Check output contract**:
The machine-readable format used by quality check scripts. Uses `---CHECK:<tool>---` delimiters for failed tool output and `---CHECK:SUMMARY---` for the final status report. Each tool appears as `tool: PASS` or `tool: FAIL`.
_Avoid_: verbose output, extra delimiters

**Context pruning**:
Reduction of transient tool-result content before it is sent back into the Pi agent context. It preserves the useful record of what happened while replacing low-value large output with compact stubs.
_Avoid_: DCP internals, context cleanup, pruning helper

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
The most recent final throughput value retained while the agent is no longer actively receiving model output, such as during tool execution between assistant streams.
_Avoid_: live speed, session statistic

**Exhausted quota window**:
A quota window whose remaining allowance is exactly zero. Compact quota status hides the zero-percent allowance and emphasizes reset timing plus any spendable balance.
_Avoid_: empty quota, blocked provider

**Spendable quota balance**:
Paid credits or dollar balance available after an exhausted quota window starts consuming fallback allowance. A known zero balance is displayed as zero; an unknown balance is displayed as `?`.
_Avoid_: credit line, quota percent

**Banked reset**:
A Codex reset credit that can restore quota before its expiry. Compact Codex status keeps the `R<n>` reset count even when the active quota window is exhausted.
_Avoid_: reset timer, quota window
