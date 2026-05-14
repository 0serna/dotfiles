## 1. Setup

- [x] 1.1 Create extension file at `dotfiles/pi/agent/extensions/advisor-hints.ts` (source; linked to `~/.pi/agent/extensions/advisor-hints.ts` via `dotfiles.json`) with TypeScript module structure exporting default factory function

## 2. Constants and State

- [x] 2.1 Define module-level constants: `TOOL_CALL_THRESHOLD` (10), `COUNTED_TOOLS` (bash, read, edit, write)
- [x] 2.2 Define module-level state variables:
  - turn-level: `toolCalls`, `nextHintAt`, `advisorCalledThisTurn`
  - session-level: `sessionId`
- [x] 2.3 Define hint text constants and passive guideline wording that leave advisor use to the agent's judgment

## 3. Event Handlers

- [x] 3.1 Register `turn_start` handler: reset per-turn flags (`advisorCalledThisTurn=false`)
- [x] 3.2 Register `tool_result` handler: increment `toolCalls` only for `bash`/`read`/`edit`/`write`; when `advisor` is called, set `advisorCalledThisTurn=true` and reset `toolCalls=0` plus `nextHintAt=TOOL_CALL_THRESHOLD`
- [x] 3.3 Register `turn_end` handler:
  - if `toolCalls` reached the next threshold and advisor was not called this turn, inject `HINT_TEXT_TURN_END`, advance `nextHintAt`, and log the `hint` event
- [x] 3.4 Remove the `agent_end` hint path entirely

## 4. Passive Guideline

- [x] 4.1 Register `before_agent_start` handler to append the passive guideline to `event.systemPrompt`

## 5. Advisor Availability Gate

- [x] 5.1 Removed advisor availability gate entirely — advisor is always available via `rpiv-advisor` package. No runtime check needed.

## 6. Logging

- [x] 6.1 Add fs imports (`appendFileSync`, `mkdirSync`, `readFileSync`, `writeFileSync`) and `dirname` from path
- [x] 6.2 Define `LOG_FILE` constant (`~/.local/state/pi/advisor-hints.log`) and `MAX_LOG_LINES` (2000)
- [x] 6.3 Implement `logEvent(eventName, details)` function: append JSON line, rotate at 2000 lines, catch all errors
- [x] 6.4 Add `sessionId` to module-level state; extract from session file filename in `session_start` handler
- [x] 6.5 Log each `hint` event with sessionId and toolCalls
- [x] 6.6 Log each `advisor` event with sessionId and toolCalls (before reset)

## 7. Session Lifecycle

- [x] 7.1 Register `session_start` handler: reset all state variables, extract `sessionId` from session file filename
