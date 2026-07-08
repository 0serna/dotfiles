# Dotfiles

This context covers the local automation and Pi agent extensions managed by this dotfiles repository.

## Language

**Check output contract**:
The machine-readable format used by quality check scripts. Uses `---CHECK:<tool>---` delimiters for failed tool output and `---CHECK:SUMMARY---` for the final status report. Each tool appears as `tool: PASS` or `tool: FAIL`.
_Avoid_: verbose output, extra delimiters

**Context pruning**:
Reduction of transient tool-result content before it is sent back into the Pi agent context. It preserves the useful record of what happened while replacing low-value large output with compact stubs.
_Avoid_: DCP internals, context cleanup, pruning helper

**Exhausted quota window**:
A quota window whose remaining allowance is exactly zero. Compact quota status hides the zero-percent allowance and emphasizes reset timing plus any spendable balance.
_Avoid_: empty quota, blocked provider

**Spendable quota balance**:
Paid credits or dollar balance available after an exhausted quota window starts consuming fallback allowance. A known zero balance is displayed as zero; an unknown balance is displayed as `?`.
_Avoid_: credit line, quota percent

**Banked reset**:
A Codex reset credit that can restore quota before its expiry. Compact Codex status keeps the `R<n>` reset count even when the active quota window is exhausted.
_Avoid_: reset timer, quota window
