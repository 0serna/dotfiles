## Context

The context extension currently derives pruning eligibility from textual `toolResult` messages plus a small ignored-tool list. This allows unreviewed future tools to be pruned by generic rules such as `duplicate`, `resolved`, or `stale_large`.

The desired posture is explicit review: a tool is only prunable when its tool name and pruning mechanism are both listed in policy.

## Goals / Non-Goals

**Goals:**

- Define pruning policy as an explicit tool/mechanism allowlist.
- Preserve current reviewed pruning behavior for known tools.
- Prevent unlisted textual tools from being pruned or counted in DCP age/metrics.
- Keep the pruning matrix aligned with the policy.

**Non-Goals:**

- Add configuration files or user-tunable pruning policy.
- Change pruning thresholds or token estimation.
- Change target extraction rules for already allowlisted tools.
- Revisit whether `web_fetch`, `web_search`, or `bash` should use `stale_large`.

## Decisions

1. **Use allowlist instead of denylist.**
   - Decision: a tool result becomes a DCP candidate only if its normalized tool name is present in the pruning policy.
   - Alternative considered: keep the ignored-tool denylist and add more exclusions. Rejected because future tools would remain pruneable by default.

2. **Allowlist by mechanism, not only by tool.**
   - Decision: each tool policy defines which of `duplicate`, `resolved`, `superseded`, and `stale_large` may apply.
   - Alternative considered: a flat tool allowlist. Rejected because approving a tool for safe duplicate pruning should not automatically approve size-based pruning.

3. **Keep ignored tools represented as non-prunable policy rows.**
   - Decision: `question` and `multi_tool_use.parallel` remain visible in the matrix with all mechanisms disabled, but implementation can simply omit them from the prunable policy.
   - Rationale: the matrix documents reviewed decisions without making them candidates.

4. **Do not support generic fallback pruning.**
   - Decision: remove `Other textual tools` from the matrix and keep unlisted tools out of DCP candidates.
   - Rationale: unknown tool semantics are safer to preserve than to compact silently.

## Risks / Trade-offs

- [Reduced token savings for new tools] → Accept until each new tool is reviewed and added to policy.
- [Policy drift from documentation] → Keep tests and the pruning matrix aligned with the policy.
- [Tool name normalization mismatch] → Continue using normalized tool names for policy checks.
