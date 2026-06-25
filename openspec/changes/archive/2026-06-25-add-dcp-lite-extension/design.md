## Context

The dotfiles repository already contains Pi extensions under `dotfiles/pi/agent/extensions/`, commonly organized as one directory per extension with an `index.ts` entry point and helper modules. Existing extensions use `dotfiles/pi/agent/extensions/shared/logger.ts` to write structured JSONL logs under `~/.local/state/pi/<extension>.log`.

Pi exposes a `context` event before each model request, allowing extensions to return a modified message list without mutating saved session entries. This is the correct integration point for a lightweight, invisible context-pruning extension.

## Goals / Non-Goals

**Goals:**

- Add a DCP extension under `dotfiles/pi/agent/extensions/dcp/`.
- Reduce stale tool-result context automatically without user or model intervention.
- Preserve conversation structure by replacing stale `toolResult` content with informational stubs instead of deleting messages.
- Keep behavior deterministic, zero-config, and fail-open.
- Use the shared extension logger with extension name `dcp`.

**Non-Goals:**

- No model-callable tools.
- No user commands.
- No system prompt injection, nudges, or model-facing instructions.
- No saved-session mutation or automatic compaction.
- No external package dependencies.

## Decisions

1. **Use `context` event only**
   - Decision: DCP will transform only the transient context returned from the `context` handler.
   - Rationale: This keeps pruning reversible and avoids modifying session history.
   - Alternative considered: Mutating session entries or triggering compaction. Rejected because it is more destructive and less suitable for a lite extension.

2. **Replace `toolResult` content with stubs instead of removing messages**
   - Decision: Stale outputs will be replaced with compact text stubs that include reason, tool, and truncated target.
   - Rationale: This preserves `tool_use` / `tool_result` structure and reduces provider-format risk.
   - Alternative considered: Removing whole messages for larger savings. Rejected because it requires more pairing repair and increases risk.

3. **Modify only `toolResult` messages**
   - Decision: DCP will not modify user messages or assistant text/tool-call messages.
   - Rationale: Tool outputs are the largest and safest pruning surface; user and assistant messages carry intent and reasoning context.
   - Alternative considered: Also pruning old assistant narrative. Rejected to keep behavior simple and safe.

4. **Use fixed balance-oriented defaults**
   - Decision: DCP will always protect the last 20 messages and prune old large command/listing outputs only above a 2000-token estimate.
   - Rationale: Zero-config requires conservative defaults that still produce meaningful token savings.
   - Alternative considered: Config files or commands. Rejected because the extension should remain invisible.

5. **Log metrics and truncated targets only**
   - Decision: DCP will log summary metrics and truncated tool targets, never full tool output content.
   - Rationale: Logs should support auditing decisions without leaking large or sensitive content.
   - Alternative considered: Detailed debug logs. Rejected because no debug command is planned and detailed logs increase sensitivity.

## Risks / Trade-offs

- **False-positive pruning could hide useful old output** → Mitigate by protecting recent messages, limiting pruning to `toolResult`, and using conservative deterministic rules.
- **Token savings are lower than full deletion** → Accepted trade-off for preserving message structure and provider safety.
- **No user commands means less live introspection** → Mitigate with structured logs in `dcp.log`.
- **Tool metadata extraction may miss some provider/message shapes** → Mitigate by treating unknown messages as unprunable and failing open on errors.
