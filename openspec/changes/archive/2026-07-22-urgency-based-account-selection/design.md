## Context

The quota extension selects the "best" OpenCode Go account at session startup and after runtime rejections. Today it ranks accounts by remaining quota percentage alone: `min(monthly, weekly, rolling)`. This ignores the reset time of each window.

A user with multiple accounts faces a "use it or lose it" scenario: an account with 20% resetting in 2 days should be spent before one with 60% resetting in 15 days, because the expiring 20% is wasted at reset.

## Goals / Non-Goals

**Goals:**

- Prioritize accounts whose largest quota window resets soonest, normalized by remaining percentage.
- Preserve existing eligibility guards: any window at 0% disqualifies the account, and all three windows must be present.
- Handle pathological cases (reset already passed, reset within minutes) with a sentinel value.
- Keep the change local to the `score()` / `selectFromSnapshot()` logic in `account-selection.ts`.

**Non-Goals:**

- Use absolute token counts (we only have percentages).
- Change the rotation, cooldown, or continuation mechanisms.
- Alter the snapshot format or refresh pipeline.

## Decisions

### Urgency rate as primary criterion

**Decision:** Rank accounts by urgency rate = `remainingPercent / daysUntilReset` computed on the largest available window (monthly → weekly → rolling fallback). Higher rate wins.

**Rationale:** This captures both dimensions that matter — how much quota is left and how soon it expires. A low percentage with a close reset (e.g., 20% in 2d → 10%/day) outranks a high percentage with a distant reset (60% in 15d → 4%/day).

**Alternatives considered:**

- _Reset time alone (no percentage weighting)_: An account with 1% resetting in 1h would beat one with 90% resetting in 2h. The 1% account is nearly exhausted and would trigger immediate rotation — wasteful.
- _Percentage alone (current behavior)_: Ignores the time dimension entirely. Rejected per the proposal.
- _Weighted composite formula_: Adds complexity without clear benefit. The rate is simple and intuitive.

### Largest-window fallback: monthly → weekly → rolling

**Decision:** Use the largest available window for the urgency computation, falling back in order.

**Rationale:** The monthly window is the most meaningful for "use it or lose it" decisions. If a provider doesn't expose monthly, we fall back to the next largest. This mirrors how the existing code treats window completeness.

### Maximum-urgency sentinel for sub-hour resets

**Decision:** When `daysUntilReset < 1/24` (less than 1 hour), assign a maximum-urgency sentinel value (`Number.MAX_SAFE_INTEGER`). Among sentinel accounts, the one with the smaller actual `daysUntilReset` wins.

**Rationale:** As `daysUntilReset` approaches zero, the rate tends to infinity, producing meaningless values. A sentinel with secondary sort by actual remaining time preserves the intent ("use the account about to expire first") without numerical instability.

### No tiebreaker threshold

**Decision:** The highest urgency always wins, even by a margin of 0.01%/day.

**Rationale:** The rate is continuous and differences are meaningful. Introducing a threshold adds complexity and a magic number to tune.

### Eligibility rules unchanged

**Decision:** The existing eligibility guards remain the first filter: any window at 0% disqualifies the account, and all three windows must be present (`score()` returns `undefined`).

**Rationale:** These rules model a real constraint — an account with an exhausted window has no usable quota regardless of urgency. Changing them is out of scope.

## Risks / Trade-offs

- **[Risk] The urgency rate can fluctuate between snapshot refreshes** as `daysUntilReset` decreases. An account selected at startup might have a lower urgency than a peer later in the session. → **Mitigation:** The module only reselects on runtime rejection, not on snapshot revision alone. The startup selection is "good enough" for the session.
- **[Risk] A nearly-exhausted account with high urgency may be selected and exhausted in one request**, triggering an immediate rotation. → **Mitigation:** This is the desired behavior — the expiring quota is used rather than wasted. The rotation mechanism already handles this.
- **[Trade-off] Purely percentage-based data without absolute token counts** means we can't distinguish "20% of 10M tokens" from "20% of 100K tokens". → **Accepted:** we don't have absolute counts from the OpenCode Go API.
