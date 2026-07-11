## 1. Configuration

- [x] 1.1 Add `apiKeyEnv` to each account in `dotfiles/pi/agent/extensions/quota/accounts.json`
- [x] 1.2 Update `AccountConfig` type in `dotfiles/pi/agent/extensions/quota/types.ts` to include `apiKeyEnv`

## 2. Rotation Logic

- [x] 2.1 Create `dotfiles/pi/agent/extensions/quota/rotation.ts` with pure rotation helpers: `initKeyStates`, `isAvailable`, `markBad`, `pickNextKey`
- [x] 2.2 Add unit tests for `rotation.ts` covering selection, cooldown, and rotation ordering

## 3. Account Activation

- [x] 3.1 Implement `activateAccount(index)` in `index.ts` that calls `setRuntimeApiKey("opencode-go", apiKey)`
- [x] 3.2 Implement `selectBestAccount()` that fetches quota for all accounts and selects the most balanced eligible account
- [x] 3.3 Wire `session_start` to call `selectBestAccount()` and `activateAccount()`
- [x] 3.4 Reject accounts with exhausted or missing quota windows and avoid exhausted-account fallback

## 4. Error Rotation

- [x] 4.1 Implement `message_end` handler to detect 429/401/403 errors for provider "opencode-go"
- [x] 4.2 On error, mark current account bad, pick next available account, and call `activateAccount(nextIndex)`
- [x] 4.3 Queue a `continue` message via `pi.sendUserMessage` after rotation so the agent resumes

## 5. Commands

- [x] 5.1 Update `/quota` output to indicate the currently active OpenCode Go account

## 6. Cleanup

- [x] 6.1 Clear rotation state on `session_shutdown`
- [x] 6.2 Run lint, typecheck, tests, and openspec validation
