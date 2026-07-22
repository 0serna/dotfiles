## 1. Core implementation

- [x] 1.1 Add `urgencyScore()` function in `account-selection.ts` that computes `remainingPercent / daysUntilReset` on the largest available window (monthly → weekly → rolling)
- [x] 1.2 Add max-urgency sentinel for windows with `daysUntilReset < 1/24` (less than 1 hour), with secondary sort by actual `daysUntilReset`
- [x] 1.3 Replace `score()` and `compareScore()` calls in `selectFromSnapshot()` with the new urgency-based ranking
- [x] 1.4 Preserve eligibility guards: return `undefined` when any window is at 0% or windows are incomplete

## 2. Tests

- [x] 2.1 Update existing test expectations in `account-selection.test.ts` to match urgency-based selection
- [x] 2.2 Add test: expiring account (20%/2d) outranks higher-percentage peer (60%/15d)
- [x] 2.3 Add test: account within 1-hour reset receives sentinel and outranks non-sentinel peers
- [x] 2.4 Add test: two sentinel accounts select the one with smaller actual `daysUntilReset`
- [x] 2.6 Add test: eligibility guards applied before urgency (zero-window account skipped)

## 3. Documentation

- [x] 3.1 Add `Quota urgency` and related terms to `CONTEXT.md`
- [x] 3.2 Create ADR `docs/adr/0005-urgency-based-account-selection.md` recording the decision and rationale
