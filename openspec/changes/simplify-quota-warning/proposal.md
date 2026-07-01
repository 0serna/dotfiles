## Why

The current warning threshold (20%) creates visual noise when windows are low but not exhausted. The only truly actionable warning is when credits/balance are being consumed because a window is fully depleted. Simplifying the warning logic makes the status bar more meaningful and reduces false urgency.

## What Changes

- Remove `LOW_QUOTA_THRESHOLD_PERCENT` constant and all threshold-based warning coloring from `formatPercentResetSegment`.
- Warning color applies **only** to credits/balance consumption segments: `C` (Codex credits) and `$` (OpenCode balance).
- Banked resets (`R`) in compact status are now visible **only** when a window is at 0%, not when below a threshold.
- Remove `suppressExhaustedWarning` parameter from `formatPercentResetSegment` (no longer needed).
- Full detail view (`/quota`) remains unchanged — resets always visible.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `quota-status`: Warning rendering rules change — threshold removed, resets visibility narrowed to exhausted-only.
- `quota-command`: No behavioral change (full detail always shows resets), but spec alignment with threshold removal.

## Impact

- `dotfiles/pi/agent/extensions/quota/status.ts`: Remove threshold constant, simplify `formatPercentResetSegment`, update `formatCodexQuotaStatus` resets logic.
- Tests in `status-helpers.test.ts` and `codex-status.test.ts`: Update assertions for new behavior.
