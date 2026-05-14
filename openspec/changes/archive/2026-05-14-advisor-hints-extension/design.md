## Context

The agent has access to an `advisor` tool — a stronger reviewer model — but rarely calls it proactively during longer or noisier workflows. Pi's extension API provides lifecycle events (`before_agent_start`, `turn_start`, `turn_end`, `tool_result`) and message injection (`sendMessage` with custom types) that can be composed into a hinting system.

The refined behavior uses two layers with distinct purposes:

- **`before_agent_start`** sets intent: if this work becomes important or worth validating, the agent should consider advisor before responding.
- **`turn_end`** is the only active intervention point: every additional 10 counted tool calls without advisor triggers another soft reminder while the agent can still act on it, especially if the work is difficult, uncertain, or worth validating before responding.

## Goals / Non-Goals

**Goals:**

- Detect when work has accumulated enough that advisor review might be worthwhile
- Let advisor usage reset the active hint progression so only post-review work counts
- Keep the final decision with the agent; activity volume suggests an opportunity, not a mandate
- Notify the user visually via a toast notification when a hint is delivered

**Non-Goals:**

- No runtime configuration commands or CLI flags
- No persistence across session reload/restore
- No cooldown or debounce system
- No attempt to infer semantic importance directly from tool usage
- No `agent_end` intervention

## Decisions

| Decision           | Choice                                                     | Rationale                                                                                            |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Delivery strategy  | Passive start guideline + repeated active `turn_end` steer | Sets intent early and intervenes only while the agent can still use advisor in the same prompt.      |
| Trigger model      | Repeated threshold multiples                               | Every additional 10 counted tools without advisor is another opportunity to reconsider review.       |
| `turn_end` role    | Primary active nudge                                       | Fire at 10, 20, 30, ... counted tools unless advisor was used in that turn.                          |
| Advisor reset      | Reset both `toolCalls` and `nextHintAt` on advisor use     | Work already reviewed via advisor should not count toward the next hint.                             |
| `agent_end` role   | Removed                                                    | The useful intervention point is before the answer is complete, not after.                           |
| Counted tools      | `bash`, `read`, `edit`, `write` only                       | Measures concrete work without over-counting meta-tools.                                             |
| Cooldown           | None                                                       | Hints are never blocked by previous hint timing.                                                     |
| Agent discretion   | Explicitly preserved in wording                            | Tool volume detects opportunity; the agent decides whether the prompt is important enough to review. |
| Toast notification | `ctx.ui.notify()` with `[advisor-hint]` prefix             | Gives the user a visual indicator that a hint was delivered, without polluting the session file.     |
| Notify escalation  | First hint `"info"`, repeated hints `"warning"`            | Scales the visual urgency after multiple ignored suggestions.                                        |
| State              | Module-level variables                                     | Simple and sufficient for per-session behavior.                                                      |

## Constants

| Parameter             | Value | Purpose                                                               |
| --------------------- | ----- | --------------------------------------------------------------------- |
| `TOOL_CALL_THRESHOLD` | 10    | `turn_end` hint each time counted work reaches another multiple of 10 |

### Counted tools

Only `bash`, `read`, `edit`, and `write` tool calls increment the counter. Other tools (`web_search`, `web_fetch`, `question`, `advisor`, etc.) are excluded so that passive lookups or meta-interactions do not trigger hints artificially.

## Logging

Every active hint emission is recorded to `~/.local/state/pi/advisor-hints.log` in JSON format for retrospective analysis.

### Log format

Each line: `ISOtimestamp eventName {...}`

Rotated at 2000 lines (by line count, not file size).

### Logged events

#### `hint`

Logged each time a hint is injected at `turn_end`. Includes:

```json
{
  "sessionId": "019e28...",
  "toolCalls": 20
}
```

#### `advisor`

Logged each time the `advisor` tool is used. Includes:

```json
{
  "sessionId": "019e28...",
  "toolCalls": 20
}
```

### Hint text — first hint

```text
HINT_TEXT_FIRST:
  "If you're having difficulty, consider using the `advisor` tool now. Otherwise, if this work is important or worth validating before you respond to the user, consider using `advisor` before you finish. If the task is simple and doesn't need review, you can skip it."
```

The first hint explicitly covers three cases: using advisor during difficulty, using advisor before responding when the work is important enough to validate, and skipping advisor when the task is simple and does not merit review.

### Hint text — repeated hints

Repeated hints add an ordinal prefix and drop the skip clause:

```text
"This is the {N}th advisor suggestion for this task. If you're having difficulty, consider using the `advisor` tool now. Otherwise, if this work is important or worth validating before you respond, consider using `advisor` before you finish."
```

## State model

### Turn-level state

- `toolCalls` (counted since the last `advisor` use)
- `nextHintAt` (next threshold multiple that should trigger a hint)
- `advisorCalledThisTurn`
- `hintsSinceAdvisor` (hints delivered since last advisor/agent_start/session_start)

### Session-level state

- `sessionId` (extracted from session file filename)

## Event flow

### `session_start`

- Reset all state
- Extract `sessionId` from session file filename

### `before_agent_start`

- Return the updated system prompt (with the passive guideline appended):
  "If this work ends up being important or worth validating before you respond, consider using the `advisor` tool."

### `agent_start`

- Reset `toolCalls` to 0, `nextHintAt` to `TOOL_CALL_THRESHOLD`, and `hintsSinceAdvisor` to 0
- Each prompt starts with a fresh counter so the active hint only fires based on work done in that prompt

### `turn_start`

- Reset per-turn flag: `advisorCalledThisTurn`

### `tool_result`

- Increment `toolCalls` only when the tool is `bash`, `read`, `edit`, or `write`
- If the tool was `advisor`, set `advisorCalledThisTurn = true`, log the `advisor` event with sessionId and toolCalls (before reset), then reset `toolCalls = 0`, `nextHintAt = TOOL_CALL_THRESHOLD`, and `hintsSinceAdvisor = 0`

### `turn_end`

- If `toolCalls >= nextHintAt` and advisor was not called this turn, inject the hint via both `ctx.ui.notify()` (toast with `[advisor-hint]` prefix) and `pi.sendMessage()` (steer with `triggerTurn: true`)
- After each injected hint, advance `nextHintAt` by threshold multiples until it exceeds `toolCalls`
- Log the `hint` event with sessionId and toolCalls

## Risks / Trade-offs

| Risk                                                                                  | Mitigation                                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Repeated hints may become background noise in very long prompts                       | Accepted for now; wording stays conditional and advisor resets the threshold progression. |
| Tool count does not perfectly capture semantic importance                             | Accepted by design; the agent retains judgment about whether review is worthwhile.        |
| Some long exploratory prompts may not trigger because they use mostly uncounted tools | Accepted for now; only concrete work tools are counted.                                   |
