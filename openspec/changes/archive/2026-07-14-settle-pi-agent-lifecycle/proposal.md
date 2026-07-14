## Why

Pi's `agent_end` marks one low-level agent attempt, not the end of retries, compaction recovery, or queued continuations. Treating it as completion restores routed models too early and publishes premature or duplicate working-stat notifications.

## What Changes

- Keep command routes active across all attempts and continuations until Pi is settled and idle.
- Activate routes for queued commands only when their user message begins processing.
- Treat manual model or thinking-level selections as explicit route cancellation.
- Measure and notify one complete processing cycle in `working-stats`, preserving elapsed wall time, last responding model, and last valid final throughput across attempts.
- Consolidate the legacy duration and throughput capabilities into the unified working-stats capability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-working-time-throughput`: Completion and cleanup move from each `agent_end` attempt to the fully settled, idle processing-cycle boundary.
- `pi-model-routing`: Route segments span retries and continuations, queued routes activate at their message boundary, manual selections cancel routing, and restoration occurs only while settled and idle.
- `pi-agent-duration-footer`: Retire the legacy duration capability in favor of `pi-working-time-throughput`.
- `pi-assistant-throughput-footer`: Retire the legacy throughput capability in favor of `pi-working-time-throughput`.

## Impact

- Affects `dotfiles/pi/agent/extensions/working-stats/` and its focused Vitest suite.
- Affects `dotfiles/pi/agent/extensions/model-routing/` and its focused Vitest suite.
- Updates and consolidates living OpenSpec specifications; the quota extension remains unchanged.
- Requires Pi `agent_settled` support, already provided by the repository's `@earendil-works/pi-coding-agent` 0.80.6 dependency.
