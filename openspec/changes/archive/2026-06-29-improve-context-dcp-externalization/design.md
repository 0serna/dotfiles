## Context

The `context` Pi extension performs DCP pruning during `context` events and publishes status/cache telemetry during lifecycle events. Current pruning replaces eligible tool outputs with informational stubs, which reduces token usage but removes the full output from the recoverable session context. Session analysis showed useful savings from `stale_large`, but also showed duplicate stubs with zero estimated savings and duplicate final `cache_status` logs caused by logging on both `turn_end` and `agent_end`.

## Goals / Non-Goals

**Goals:**

- Make DCP stubs recoverable by writing pruned output text above the threshold to temporary per-session files.
- Apply a single 1000-token pruning threshold to all pruning mechanisms.
- Increase the `stale_large` age gate to 30 DCP-ageable tool results.
- Avoid applying pruning decisions that do not reduce estimated token count.
- Stop duplicate final cache telemetry by logging `cache_status` only on `turn_end`.

**Non-Goals:**

- No automatic cleanup of DCP temporary files; the host system is responsible for temporary-file lifecycle.
- No generated summaries or previews in the stub.
- No change to the explicit tool/mechanism pruning policy allowlist.
- No change to cache hit rate computation or status bar formatting except avoiding duplicate logs.

## Decisions

1. **Use per-session temporary files for externalized outputs.**
   - Pruned output text whose estimated size exceeds 1000 tokens will be written under a DCP temp directory keyed by session id and pruning pass/output identity.
   - Rationale: the agent can recover removed text with the normal `read` tool if it becomes relevant later.
   - Alternative considered: keep only in-context stubs. Rejected because it permanently removes useful older evidence from the session branch.

2. **Use minimal recoverable stubs.**
   - Stub format will include the pruning reason and saved file path, omitting obvious metadata and previews.
   - Rationale: keeps stubs cheap and predictable while preserving recoverability.
   - Alternative considered: include preview or generated summary. Rejected to avoid extra tokens and additional model/tool complexity.

3. **Apply a global 1000-token threshold to every pruning mechanism.**
   - `duplicate`, `resolved`, `superseded`, and `stale_large` will only prune outputs above the threshold.
   - Rationale: small outputs are cheap and often useful for continuity; stubs can cost as much as the original.
   - Alternative considered: threshold only for `stale_large`. Rejected because duplicate/resolved/superseded stubs with no savings were observed.

4. **Keep age gating specific to `stale_large`.**
   - `stale_large` requires `dcpAge > 30`; semantic pruning mechanisms may operate immediately once they exceed the threshold.
   - Rationale: semantic mechanisms are safer earlier, while size-only pruning benefits from a stronger recency guard.

5. **Prune only when estimated savings are positive.**
   - A decision is applied only if the original estimated token count is greater than the replacement stub estimated token count.
   - Rationale: metrics and context should not be worsened by a pruning action.

6. **Log cache status only on turn end.**
   - `agent_end` may still publish status, but it will not write another `cache_status` event.
   - Rationale: avoids duplicated identical final telemetry while preserving useful turn-level logs.

## Risks / Trade-offs

- **Recoverability depends on the agent choosing to read the file** → The stub includes a direct filesystem path to make recovery explicit.
- **Temporary files may accumulate** → Accepted; cleanup is intentionally delegated to the system temporary-file policy.
- **Externalized files may contain sensitive tool output** → Store only under local temporary paths and avoid logging full output content.
- **Higher `stale_large` age gate may delay pruning** → The lower 1000-token threshold and semantic mechanisms compensate while preserving recent large outputs.
