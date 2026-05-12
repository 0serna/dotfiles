## Context

The managed Pi footer shows both context-window usage and cache metrics for the active session. Recent review confirmed that these metrics have different scopes: context usage reflects current context occupancy for the active branch state, while cache usage summarizes prompt-side cache reuse across assistant responses in that branch.

## Goals / Non-Goals

**Goals:**

- Preserve the distinction between current context-window usage and cumulative session totals.
- Define cache reporting in a way that matches provider usage fields already recorded in session history.
- Document unknown states so future changes do not invent misleading fallback values.

**Non-Goals:**

- Changing footer runtime behavior.
- Adding new footer metrics or changing footer layout.
- Specifying provider-internal caching mechanics beyond the usage fields exposed to Pi.

## Decisions

- Treat footer context usage as the current context-window estimate for the active session state, not as cumulative token traffic. This matches Pi's built-in `contextUsage` semantics used for footer display and compaction decisions.
- Treat cumulative token totals as a separate concern. They may be reported elsewhere, but they MUST NOT replace context-window usage in the footer context field.
- Define cache percentage from prompt-side assistant usage totals only: cache-read tokens divided by total prompt-side input tokens (`input + cacheRead`). This excludes output and cache-write tokens because they do not describe cache-hit rate for prompt reuse.
- Allow unknown values when the underlying session state does not support a trustworthy estimate, such as immediately after compaction or when no prompt-side input has been recorded.

## Risks / Trade-offs

- [Readers may expect session totals in the context field] → Explicitly specify that the field represents current context occupancy, not historical totals.
- [Provider usage fields vary] → Anchor behavior to Pi's normalized usage fields and documented `contextUsage` contract instead of provider-specific labels.
- [Unknown states can look incomplete] → Require unknown display rather than inaccurate derived values.
