## Context

The quota extension was recently refactored to remove its status footer and polling behavior, keeping only the on-demand `/quota` command. It already reads multiple OpenCode Go accounts from `accounts.json` and fetches each account's quota from the OpenCode dashboard.

The remaining gap is that pi does not automatically switch between accounts when one hits its rate limit during an active turn. The user must stop and manually determine which account still has quota. The `pi-keyrouter` extension demonstrates a rotation pattern using `authStorage.setRuntimeApiKey`, but it hooks into `message_end`, which is too late to continue an interrupted turn. The quota extension uses `message_end` together with an automatic follow-up continuation.

## Goals / Non-Goals

**Goals:**

- On session start, fetch all OpenCode Go accounts, reject accounts with exhausted or missing quota windows, and activate the most balanced eligible account via `setRuntimeApiKey`.
- During a turn, on 429/401/403 responses from OpenCode Go, rotate to the next account with available quota and no active cooldown.

- Keep the implementation minimal: reuse pure rotation logic from `pi-keyrouter` without importing the package.

**Non-Goals:**

- Rotating Codex API keys (Codex has its own quota model and a single auth source here).
- Persisting rotation state across sessions.
- Supporting providers other than OpenCode Go.
- Implementing a general key-router abstraction.

## Decisions

### Use `message_end` for rotation

The `after_provider_response` hook is documented as firing after the HTTP response, but in practice it does not fire (or does not expose the error status) for OpenCode Go 429 responses. Therefore rotation happens at `message_end` when the assistant message has `stopReason === "error"`. After rotating the runtime API key, the extension queues a `sendUserMessage("continue")` as a `followUp`, which triggers a new turn with the new key.

**Alternative considered:** `after_provider_response`. Rejected because it did not produce rotation events in real 429 sessions; only `message_end` saw the error.

### Restructure `accounts.json` by provider

`accounts.json` becomes an array of provider entries. Each entry has a `provider` identifier (e.g. `"opencode-go"`) and an `accounts` array. Account objects keep `name`, `apiKeyEnv`, `workspaceEnv`, and `cookieEnv`. This makes the provider explicit and leaves room for future Codex or other provider accounts without ambiguity.

**Alternative considered:** Adding a `provider` field to each flat account. Rejected because grouping by provider keeps provider-specific config (cooldowns, fetch logic) scoped and easier to extend.

### Select by quota bottleneck

Account availability is validated in order: monthly, weekly, then rolling. All three windows must report a positive remaining percentage. Among eligible accounts, selection maximizes the smallest remaining percentage, with monthly, weekly, and rolling as tie-breakers. This avoids consuming an account that has a high monthly balance but is nearly exhausted in a shorter window.

If no account is eligible, the extension does not activate an account and notifies the user instead of falling back to an exhausted account.

### Store rotation state in a module-level map

Rotation state (current index, cooldown deadlines, failure counts) is kept in memory in `index.ts` and cleared on `session_shutdown`.

**Alternative considered:** `pi.appendEntry` persistence. Rejected because cooldown windows are intentionally short and session-scoped.

### Reuse pure rotation logic from `pi-keyrouter`

A new `rotation.ts` module will contain the adapted state-machine functions (`initKeyStates`, `isAvailable`, `markBad`, `pickNextKey`). This keeps `index.ts` focused on pi hooks and avoids a new npm dependency.

## Risks / Trade-offs

- **Pi may not retry automatically from `after_provider_response`.** → Mitigation: implement fallback `sendUserMessage` continuation and test both paths.
- **Account selection on startup uses dashboard quota, which can lag behind actual provider rate-limit state.** → Mitigation: treat provider errors as authoritative and rotate even if the dashboard suggested quota was available.
- **Multiple provider errors in rapid succession could exhaust all accounts before any cooldown expires.** → Mitigation: keep cooldown state session-scoped and accept that the agent pauses when all accounts are exhausted.

## Migration Plan

1. Update `accounts.json` to add `apiKeyEnv` for each existing account.
2. Implement `rotation.ts` with tests.
3. Add lifecycle hooks and automatic rotation to `index.ts`.
4. Update existing quota tests and run the full quality gate.

## Open Questions

1. Does `after_provider_response` for OpenCode Go expose HTTP status codes, or is the response abstracted? If status is unavailable, we may need to inspect `message_end` error text instead.
2. Does `setRuntimeApiKey("opencode-go", ...)` immediately affect the in-flight request, or only the next one? This determines whether we rely on pi retry or need an explicit continuation.
