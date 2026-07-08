## Context

DCP (Dynamic Context Pruning) is a Pi extension that reduces stale tool result content in transient context to improve cache stability and reduce token consumption. Currently, DCP:

1. Creates temporary files in `/tmp/pi-dcp/` when pruning tool results
2. Requires a 500-token minimum size threshold for `stale_large` pruning
3. Tracks `staleLargeProtectedCount` metric for results protected by the size threshold

The user has identified that:

- The agent never reads the DCP-created files back during sessions
- The size threshold adds unnecessary complexity
- The `staleLargeProtectedCount` metric is no longer needed

## Goals / Non-Goals

**Goals:**

- Remove DCP-owned file creation while preserving bash log references
- Simplify `stale_large` pruning to be age-only (no size threshold)
- Remove unnecessary constants and metrics
- Maintain the positive-savings guard (don't apply stubs that increase tokens)

**Non-Goals:**

- Changing the `superseded` pruning mechanism
- Modifying the age threshold (`STALE_LARGE_MIN_AGE`)
- Affecting the pruning interface or metrics reporting format

## Decisions

### Decision 1: Remove DCP-owned file creation

**Choice**: Remove `externalizeOutput()` and `writeTempOutputSync` import from `pruning/stub.ts`. Keep `extractFullOutputPath()` to detect existing bash logs.

**Rationale**: The agent never reads DCP-created files. The `saved=` field in stubs is only useful when pointing to existing bash logs that Pi already creates.

**Alternative considered**: Keep file creation but make it optional. Rejected because it adds complexity with no benefit.

### Decision 2: Remove size threshold from `stale_large`

**Choice**: Remove `PRUNE_TOKEN_THRESHOLD` constant and the token check in `decideStubs()`. `stale_large` applies to any tool result older than `STALE_LARGE_MIN_AGE`.

**Rationale**: The size threshold was initially added to preserve small outputs that might still be useful. However, the age threshold alone is sufficient—if a result is old enough, it's stale regardless of size.

**Alternative considered**: Lower the threshold to 100 tokens. Rejected because it still adds complexity without clear benefit.

### Decision 3: Remove `staleLargeProtectedCount` metric

**Choice**: Remove `staleLargeProtectedCount` from `PruneMetrics` type and metrics calculation.

**Rationale**: This metric tracked results protected by the size threshold. With no size threshold, there's nothing to protect.

**Alternative considered**: Keep metric but always report 0. Rejected because it's dead code.

### Decision 4: Keep positive-savings guard

**Choice**: Maintain the check that only applies stubs when they reduce estimated token count.

**Rationale**: Without this guard, DCP could apply stubs that are larger than the original content (especially for small outputs). This would increase context size instead of reducing it.

## Risks / Trade-offs

**Risk**: Removing size threshold may prune small outputs that are still useful.
→ **Mitigation**: The age threshold (`STALE_LARGE_MIN_AGE = 25`) provides sufficient protection. Results younger than this are preserved.

**Risk**: Removing file creation means pruned content is permanently lost.
→ **Mitigation**: The agent never reads these files anyway. If recovery is needed, the original tool can be re-executed.

**Risk**: Removing `staleLargeProtectedCount` metric may affect monitoring.
→ **Mitigation**: The metric was not actively monitored. Other metrics (`stubbedCount`, `estimatedSavedTokens`) provide sufficient visibility.

## Migration Plan

No migration needed. This is a pure simplification of existing behavior:

- No schema changes
- No configuration changes
- No breaking changes to the pruning interface

## Open Questions

None. All decisions are straightforward based on user requirements.
