## Why

The agent frequently completes substantial work without pausing to verify it with the `advisor` tool. The extension bridges this gap by:

1. **Prompt-level intent** — each prompt starts with a passive reminder that advisor is available when the work ends up being important.
2. **Mid-stream churn** — every 10 counted tool calls without advisor indicates enough activity to ask whether the work is worth reviewing before responding.

## What Changes

- New file: `dotfiles/pi/agent/extensions/advisor-hints.ts` (source) → `~/.pi/agent/extensions/advisor-hints.ts` (linked target)
- The extension nudges at two levels:
  - **`before_agent_start`**: appends a passive guideline reminding the agent to consider `advisor` before responding when this work becomes important or worth validating.
  - **`turn_end`**: injects a soft active hint every time counted tool calls reach another multiple of `TOOL_CALL_THRESHOLD` without an intervening `advisor` call.
- Using `advisor` resets both the counted tool total and the next threshold.
- All thresholds are compile-time constants; no runtime configuration commands.
- No cooldown system: hints are never suppressed by previous hint timing.
- Hint and advisor events are logged to `~/.local/state/pi/advisor-hints.log` for retrospective analysis.

## Capabilities

### New Capabilities

- `advisor-suggestion`: Detects when the agent has done enough work that review might be worthwhile and suggests using the `advisor` tool without making it mandatory.

### Modified Capabilities

_(none)_

## Impact

- Adds `dotfiles/pi/agent/extensions/advisor-hints.ts`
- No new dependencies
- Minimal runtime overhead (module-level counters plus occasional hint injection)
