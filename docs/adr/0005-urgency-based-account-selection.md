# Select accounts by quota urgency, not just remaining percentage

The account-selection module previously ranked OpenCode Go accounts purely by remaining quota percentage (`min(monthly, weekly, rolling)`). This ignored _when_ each account's quota resets, causing expiring quota to be wasted. We changed the criterion to an urgency rate (`remainingPercent / daysUntilReset` on the largest available window) so accounts whose quota expires sooner are spent first. The existing eligibility guards (zero-window exclusion, three-window completeness) remain as the first filter.

## Considered Options

- **Reset time alone (no percentage weighting):** A nearly-exhausted account (1%) with a close reset would beat a fuller account (90%) with a slightly later reset. The 1% account would exhaust immediately, triggering wasteful rotation.
- **Percentage alone (previous behavior):** Ignores the time dimension entirely. The 60%/15d account always beats the 20%/2d account, wasting the expiring 20%.
- **Urgency rate (chosen):** Balances both dimensions. 20%/2d = 10%/day beats 60%/15d = 4%/day, reflecting real urgency to spend before reset.
