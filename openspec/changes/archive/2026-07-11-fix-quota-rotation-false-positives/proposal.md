## Why

The quota extension rotates OpenCode Go API keys on every `stopReason: "error"`, treating all errors as rate-limit events. Analysis of session logs from 2026-07-11 shows a 50% false-positive rate: 2 of 4 rotations were triggered by transient errors (`Request timed out.`, `Stream ended without finish_reason`) rather than actual quota exhaustion. This causes unnecessary key rotations, misleading logs, and sometimes switches to accounts with worse quota (e.g., 0% monthly). Pi already handles transient errors via automatic retry — the extension should not intervene.

## What Changes

- Restrict rotation trigger to explicit `GoUsageLimitError` (HTTP 429 with quota exhaustion) only, matching on `errorMessage` content
- Track which accounts have been tried in the current turn via a `Set<string>`, reset on `turn_start`
- Stop rotating when all accounts have been attempted in the same turn — notify the user via UI instead of looping
- Keep the automatic `continue` message only after a legitimate quota-driven rotation
- Transient errors (timeouts, stream interruptions, network failures) are ignored — pi's built-in retry handles them

## Capabilities

### New Capabilities

- `quota-rotation-guard`: Detects genuine quota exhaustion vs transient errors and manages rotation cycles with per-turn exhaustion tracking

### Modified Capabilities

None — no existing specs cover this behavior.

## Impact

- `dotfiles/pi/agent/extensions/quota/index.ts`: `makeMessageEndHandler` logic and rotation cycle tracking
- `dotfiles/pi/agent/extensions/quota/rotation.ts`: unchanged (existing helpers remain)
- No API changes, no dependency changes
