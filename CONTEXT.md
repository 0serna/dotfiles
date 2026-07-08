# Dotfiles

This context covers the local automation and Pi agent extensions managed by this dotfiles repository.

## Language

**Check output contract**:
The machine-readable format used by quality check scripts. Uses `---CHECK:<tool>---` delimiters for failed tool output and `---CHECK:SUMMARY---` for the final status report. Each tool appears as `tool: PASS` or `tool: FAIL`.
_Avoid_: verbose output, extra delimiters

**Context pruning**:
Reduction of transient tool-result content before it is sent back into the Pi agent context. It preserves the useful record of what happened while replacing low-value large output with compact stubs.
_Avoid_: DCP internals, context cleanup, pruning helper
