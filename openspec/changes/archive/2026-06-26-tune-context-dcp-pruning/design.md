## Context

The context extension includes DCP pruning that runs during Pi context construction and replaces eligible stale `toolResult` content with short stubs. Existing behavior is intentionally conservative: the last 20 messages are protected, and large-output pruning only applies to command/listing/search results over a 2000-token estimate.

Session analysis showed that this works well but leaves additional stale medium-to-large tool results in long sessions. Some unpruned outputs were not missed because of tool identity; they were missed because the threshold and semantic filter were conservative.

## Goals / Non-Goals

**Goals:**

- Reduce stale context size in long tool-heavy sessions.
- Preserve immediate operational context with a shorter protected window.
- Make large-output pruning based on generic `toolResult` size and age rather than tool/project-specific names.
- Keep pruning transient and non-destructive.

**Non-Goals:**

- Add rules for specific tools such as Playwriter, `uv`, or project-specific job-search commands.
- Change saved session history or trigger compaction.
- Summarize pruned output content.
- Change pruning behavior for `question` tool results.

## Decisions

- Reduce recent-message protection from 20 to 15 messages.
  - Rationale: session simulation showed 15 adds useful pruning without becoming as aggressive as 10.
  - Alternative considered: 10 messages. Rejected as more likely to remove still-useful recent evidence.

- Reduce the large-output threshold from 2000 to 1500 estimated tokens.
  - Rationale: several stale outputs in the 1500-2000 token range contributed context bulk but were old enough to stub safely.
  - Alternative considered: keep 2000. Rejected because it left measurable stale context in the analyzed session.

- Make `old_large_output` apply to any textual `toolResult` outside the protected window that exceeds the threshold.
  - Rationale: DCP should be tool-agnostic. Size and age are the relevant pruning signals for this rule.
  - Alternative considered: add explicit Playwriter or project command rules. Rejected because those couple DCP to session/project behavior.

- Keep `question` ignored.
  - Rationale: question results encode direct user decisions and should remain intact regardless of size or age.

## Risks / Trade-offs

- Large old outputs can still contain useful evidence → mitigated by preserving the last 15 messages and leaving stubs with reason, tool name, and target.
- Lowering the threshold may increase stubbing volume → mitigated by keeping pruning transient and logging metrics for review.
- Tool-agnostic pruning may affect custom tools unexpectedly → mitigated by requiring both age and size, and by retaining the `question` exclusion.
