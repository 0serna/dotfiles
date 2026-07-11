## Why

When the OpenCode Go provider hits its rate limit mid-turn, the agent stops and the user must send another prompt to continue. The quota extension already tracks multiple OpenCode accounts, but it does not automatically rotate between them. We need a minimal rotation mechanism that picks an account with available quota at startup and switches to the next account when the current one fails, so the agent can continue without manual intervention.

## What Changes

- Restructure `dotfiles/pi/agent/extensions/quota/accounts.json` as an array of providers, each with an array of accounts that include `apiKeyEnv`, `workspaceEnv`, and `cookieEnv`.
- Add a `rotation.ts` module with pure key/account rotation logic adapted from `pi-keyrouter` (key states, pick-next, cooldown tracking).
- Add a `session_start` hook in the quota extension to fetch quota for all configured OpenCode accounts, reject accounts with any exhausted or missing quota window, and activate the most balanced eligible account via `authStorage.setRuntimeApiKey("opencode-go", key)`.
- Add a `message_end` hook that detects provider errors (429/401), rotates to the next available account, and queues a `continue` message so the agent resumes automatically.

- Update `types.ts` with rotation state types.
- Remove or update leftover status-footer assumptions from the previous refactor.

## Capabilities

### New Capabilities

- `opencode-account-rotation`: Automatically select and rotate between multiple OpenCode Go accounts based on real-time quota and provider error responses.

### Modified Capabilities

- `quota-command`: The `/quota` command continues to show usage for all accounts and indicates the currently active account.

## Impact

- Affected files: `dotfiles/pi/agent/extensions/quota/index.ts`, `types.ts`, `accounts.json`, plus new `rotation.ts`.
- Affected tests: existing quota tests need rotation coverage; new tests for `rotation.ts` pure logic.
- No changes to the dotfiles installer or other extensions.
