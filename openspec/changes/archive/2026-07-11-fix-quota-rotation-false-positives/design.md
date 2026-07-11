## Context

The quota extension (`dotfiles/pi/agent/extensions/quota/`) manages OpenCode Go API key rotation across multiple accounts. It currently hooks into the `message_end` pi event and triggers rotation whenever `stopReason === "error"` on the `opencode-go` provider, regardless of the actual error type. The `makeMessageEndHandler` in `index.ts` is the only code path that needs to change.

Existing state: `accountStates` (rotation state), `currentAccountIndex`, `continuationSentThisTurn` (per-turn flag reset on `turn_start`). Rotation helpers live in `rotation.ts`: `markBad`, `pickNextAccount`, `isAvailable`.

## Goals / Non-Goals

**Goals:**

- Only rotate on explicit quota exhaustion errors (`GoUsageLimitError` or `429:` prefix in `errorMessage`)
- Track per-turn attempted accounts so the extension stops rotating once all accounts have been tried
- Preserve the automatic `continue` message for legitimate rotations only
- Transient errors (timeouts, stream interruptions, network failures) are silently ignored

**Non-Goals:**

- Re-evaluating quota data (via `fetchOpenCodeGoData`) during rotation
- Changing the cooldown mechanism or `RotationReason` type
- Modifying `session_start` account selection logic
- Handling the `unauthorized` case (already unused in code)

## Decisions

### Decision 1: Match on `errorMessage` substring rather than HTTP status code

The `message_end` event exposes `errorMessage` as a string. Real quota errors consistently contain `GoUsageLimitError` (from session log evidence: `"429: {\"type\":\"GoUsageLimitError\",...}"`). Checking for this substring is simpler and more robust than parsing the HTTP status, since the error message format is provider-controlled and predictable.

**Alternative considered:** Parsing the `errorMessage` as JSON and checking `type`. Rejected because the message format could vary (some errors have a `429:` prefix with JSON body, some might not), and substring matching handles both formats.

### Decision 2: Per-turn `Set<string>` for attempted accounts instead of a counter

A `Set<string>` of account names is more precise than a counter because accounts can be on cooldown and skipped by `pickNextAccount`. With a counter, skipping on-cooldown accounts would incorrectly increment the count. With a Set, only accounts that are actually activated count as attempted.

The Set is reset on `turn_start` alongside `continuationSentThisTurn`.

**Alternative considered:** Tracking by index. Rejected because account indices can change if `accountStates` is rebuilt (though it currently isn't within a session). Names are stable.

### Decision 3: Stop + notify on full cycle exhaustion, no infinite loop

When all accounts have been tried in a turn and the current one just hit `GoUsageLimitError`, the extension stops rotating and shows a UI notification. It does NOT send a `continue` message (there's no point — all accounts are exhausted). Pi's built-in retry will handle the gap naturally.

## Risks / Trade-offs

- **[Risk] False negatives:** A real quota error that doesn't contain `GoUsageLimitError` in the message would be missed. → **Mitigation:** All observed quota errors from OpenCode Go use this exact error type. If the provider changes error format, the extension will silently stop rotating (pi's retry will handle it, and the user will notice degraded behavior). The quota log makes this diagnosable.

- **[Risk] Set grow unbounded:** If the same account keeps hitting quota errors within a turn (after cooldown expiry), the Set only adds each name once, so it won't grow beyond the number of configured accounts.

- **[Trade-off] No quota re-check during rotation:** The extension does not re-fetch quota data when rotating. An account with 0% monthly that was skipped at session start could be selected by `pickNextAccount`. The user explicitly chose not to add this complexity in this change.
