## Context

The context extension owns DCP pruning during Pi context construction. Current pruning preserves the last 15 absolute context messages before considering any rule. That makes ignored tools such as `question` indirectly affect pruning by consuming recent-message slots even though they are intentionally excluded from pruning.

The current `old_large_output` rule uses a 1500-token threshold after the global window. Because this rule relies only on age and size, it needs a more explicit and conservative gate than semantic rules such as duplicate output or resolved errors.

## Goals / Non-Goals

**Goals:**

- Make ignored tools invisible to DCP pruning, metrics, and age calculations.
- Remove global recent-message protection so semantic stale-output rules can work immediately.
- Add a dedicated age gate for `old_large_output` using DCP-ageable tool results.
- Make size-based pruning more conservative with a 2500-token threshold.
- Reduce false positives in `superseded_file_operation` by requiring the same normalized tool and target.

**Non-Goals:**

- Add user-facing configuration, commands, tools, notifications, or prompt instructions.
- Change saved session history or trigger compaction.
- Summarize pruned outputs.
- Change the `question` tool's ignored status.

## Decisions

1. **Use DCP-ageable tool results for age.**
   - Decision: Age calculations count only `toolResult` messages with usable metadata whose tool is not ignored.
   - Rationale: Ignored tools should not indirectly alter pruning behavior.
   - Alternative considered: Continue using absolute message indexes. Rejected because `question` and other ignored messages can inflate protection windows.

2. **Remove global recent-message protection.**
   - Decision: `duplicate_output`, `resolved_error`, and `superseded_file_operation` can apply immediately when their deterministic conditions are met.
   - Rationale: These rules have semantic stale-output evidence and do not need a separate recency delay.
   - Alternative considered: Keep a 15-result DCP-ageable protected window. Rejected because it delays safe pruning and preserves stale duplicates/errors unnecessarily.

3. **Gate only `old_large_output` by age and size.**
   - Decision: `old_large_output` applies only when the candidate is older than 20 DCP-ageable tool results and exceeds 2500 estimated tokens.
   - Rationale: Size-only pruning is the least semantic rule, so it needs the strongest guard.
   - Alternative considered: Keep the 1500-token threshold. Rejected as too aggressive once global protection is removed.

4. **Keep `SKILL.md` protected from size-only pruning.**
   - Decision: Explicit `read` results for paths ending in `SKILL.md` remain excluded from `old_large_output`, but can still be pruned by semantic rules.
   - Rationale: Skill instructions can remain behaviorally important even when large or old; repeated reads are still safely superseded by later reads of the same skill.
   - Alternative considered: Apply the 2500-token threshold to skills. Rejected because it risks removing active instruction context.

5. **Constrain superseded file pruning to the same tool.**
   - Decision: A file operation supersedes an earlier file operation only when both normalized tool name and normalized target match.
   - Rationale: `read -> edit` and `edit -> read` carry different semantics and can both be useful; `read -> read` is a clearer replacement.
   - Alternative considered: Continue target-only superseding. Rejected as too broad without a global protected window.

6. **Rename protection metrics around the size gate.**
   - Decision: Replace `protectedRecentCount` with an `oldLargeProtectedCount`-style metric.
   - Rationale: There is no longer global recent protection, so the metric should describe candidates protected only from size-based pruning.
   - Alternative considered: Keep the old name with new meaning. Rejected because it would make logs misleading.

## Risks / Trade-offs

- Recent duplicate outputs may be stubbed immediately → Accepted because an identical kept copy remains available.
- Resolved errors may lose diagnostic details after a later success → Mitigated by requiring a successful later result for the same operation and retaining a reasoned stub.
- Same-tool superseding saves fewer tokens than target-only superseding → Accepted for safer semantics.
- Higher size threshold reduces token savings from `old_large_output` → Mitigated by immediate semantic pruning and clearer safety.
