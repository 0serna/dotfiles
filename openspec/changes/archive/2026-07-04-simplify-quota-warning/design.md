## Context

The quota extension shows a compact status bar with per-provider quota info. Currently `status.ts` has a `LOW_QUOTA_THRESHOLD_PERCENT = 20` constant that:

1. Colors `formatPercentResetSegment` output yellow when percent < 20%.
2. Shows banked resets (`R`) in Codex compact when below threshold.

The user has determined that threshold-based warnings create false urgency. The only actionable signal is credits/balance consumption when a window is fully depleted.

## Goals / Non-Goals

**Goals:**

- Remove threshold-based warning coloring entirely.
- Reserve warning color exclusively for credits/balance consumption segments.
- Show banked resets (`R`) in compact only when a window is at 0%.
- Simplify `formatPercentResetSegment` signature by removing `suppressExhaustedWarning`.

**Non-Goals:**

- Changing full detail view (`/quota`) — resets always visible there.
- Changing window selection logic (`selectCompactWindows`).
- Changing OpenCode or Codex fetch/parsing logic.

## Decisions

**Remove `LOW_QUOTA_THRESHOLD_PERCENT` entirely** rather than changing its value.
The concept of a percentage threshold for warnings is being eliminated, not adjusted. Keeping a constant with a different value would be misleading.

**Remove `suppressExhaustedWarning` parameter** from `formatPercentResetSegment`.
This parameter existed to suppress warning color when percent === 0 but credits were being consumed. With threshold-based warning removed, there is no warning to suppress at the percent level. Warning color is now only applied to credits/balance segments directly.

**Keep `belowThreshold` variable replaced with `windowExhausted`** in `formatCodexQuotaStatus`.
The `belowThreshold` check (percent < 20%) is replaced by `windowExhausted` (percent === 0%) for controlling resets visibility. This is the sole gate for showing `R` in compact.

## Risks / Trade-offs

- [Risk] Users may miss early warning when quota is running low but not exhausted. → Mitigation: The reset time already provides awareness of when quota refreshes. Users who need deeper info can run `/quota`.
- [Risk] `formatPercentResetSegment` is exported and tested with the old signature. → Mitigation: Update all tests to match new 4-parameter signature.
