## 1. Status formatting cleanup

- [x] 1.1 Remove `LOW_QUOTA_THRESHOLD_PERCENT` constant from `status.ts`
- [x] 1.2 Remove `suppressExhaustedWarning` parameter from `formatPercentResetSegment`
- [x] 1.3 Remove threshold-based warning logic from `formatPercentResetSegment` — percentage always uses `dim` color
- [x] 1.4 Update `formatCodexQuotaStatus`: replace `belowThreshold` gate with `windowExhausted` for resets visibility

## 2. Tests

- [x] 2.1 Update `status-helpers.test.ts` for new `formatPercentResetSegment` signature (4 params instead of 5)
- [x] 2.2 Update `codex-status.test.ts` for resets-only-when-exhausted behavior
- [x] 2.3 Verify `opencode-status.test.ts` and `provider-status.test.ts` still pass
- [x] 2.4 Update `full-detail.test.ts` if affected
