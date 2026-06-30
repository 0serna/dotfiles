## Context

Managed Pi extensions live under `dotfiles/pi/agent/extensions` and publish footer segments through `ctx.ui.setStatus`. The existing `footer` extension centralizes presentation by reading extension statuses, so duration tracking should remain a separate extension that only publishes its own status.

Pi emits `agent_start` and `agent_end` for each prompt-level agent run. Session history persists timestamped message entries, but not explicit `agent_start` or `agent_end` records, so historical duration can only be inferred from message boundaries.

## Goals / Non-Goals

**Goals:**

- Add a standalone `duration` extension that publishes compact agent-duration status.
- Show a live elapsed timer during active agent runs with one-second updates.
- Show the most recent completed agent duration after completion.
- Infer the most recent completed duration from persisted session messages on session start or reload.
- Keep footer layout responsibility in the existing `footer` extension.

**Non-Goals:**

- Modifying Pi internals or the built-in footer component.
- Measuring individual tool calls or individual LLM turns.
- Persisting a separate duration cache.
- Adding configuration for labels, intervals, or formatting.

## Decisions

- Use `agent_start`/`agent_end` as the live measurement boundary.
  - Rationale: the user wants prompt-level agent duration, not internal turn duration.
  - Alternative considered: `turn_start`/`turn_end`; rejected because a single prompt can include multiple turns.

- Publish status with key `duration` through `ctx.ui.setStatus`.
  - Rationale: the existing footer extension already gathers non-excluded status keys and presents them.
  - Alternative considered: extending the footer extension; rejected to preserve separation of computation and layout.

- Update the live display every second while the agent is active.
  - Rationale: a one-second interval is cheap and gives useful progress feedback.
  - Alternative considered: update only on `agent_end`; rejected because it would not show in-progress elapsed time.

- Infer historical duration from the latest user-message block in session entries.
  - Rationale: session files persist message timestamps but not agent lifecycle events.
  - Alternative considered: writing a dedicated cache; rejected because the session already provides enough approximate history and cache adds avoidable state.

- Keep formatting compact and fixed: always `⏱ <duration>` for live, completed, and inferred durations.
  - Rationale: footer space is limited and a single stable format keeps the status easy to scan.

## Risks / Trade-offs

- Historical inference may not exactly match live `agent_start`/`agent_end` timing → Treat the inferred value as a best-effort footer hint and use exact event timing for active runs.
- Aborted runs or unusual flows may leave incomplete message boundaries → Do not invent a duration when no valid user-to-generated-message span can be found.
- Intervals can leak if not cleaned up → Clear the interval on `agent_end` and `session_shutdown`.
- Unicode stopwatch width may vary by terminal → Keep the segment short and let the footer truncation handle width constraints.
