## Why

Account selection currently ranks OpenCode Go accounts purely by remaining quota percentage — the account with the highest `min(monthly, weekly, rolling)` wins. This ignores a dimension that matters: _when_ each account's quota window resets. An account with 20% remaining that resets in 2 days should be spent before an account with 60% that resets in 15 days, because the expiring 20% is lost at reset. Today the 60% account always wins and the expiring quota is wasted.

## What Changes

- Replace the percentage-only `score()` function with an **urgency rate** that divides the largest available window's remaining percentage by its days until reset. Higher urgency wins.
- Introduce a **maximum-urgency sentinel** for accounts whose largest window resets in less than one hour, with a secondary sort by actual remaining time.
- The largest available window is determined by fallback: monthly → weekly → rolling.
- Existing eligibility guards (any window at 0% → ineligible, all three windows must be present) are preserved as the first filter.
- Update the glossary in `CONTEXT.md` with the new terms.

## Capabilities

### New Capabilities

- `quota-urgency-scoring`: Urgency-based account selection criterion that prioritizes accounts whose quota is closest to expiring.

### Modified Capabilities

- `quota-runtime-architecture`: The account selection scoring algorithm changes from pure percentage comparison to urgency-rate comparison. The existing eligibility rules (zero-window exclusion, completeness check) remain unchanged.

## Impact

- `dotfiles/pi/agent/extensions/quota/account-selection.ts` — `score()` and `compareScore()` replaced with urgency-based equivalents
- `dotfiles/pi/agent/extensions/quota/tests/account-selection.test.ts` — test cases updated for urgency-driven selection
- `CONTEXT.md` — new glossary terms added
