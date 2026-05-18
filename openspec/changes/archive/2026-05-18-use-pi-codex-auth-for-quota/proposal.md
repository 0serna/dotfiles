## Why

The Codex quota footer currently reads OpenCode credentials, which can expire independently of Pi and leave the footer blank even after the user logs into Codex through Pi. Pi already owns Codex OAuth credentials and refresh behavior via `/login`, so the footer should use Pi's auth source.

## What Changes

- Change the Codex quota footer extension to resolve its Codex access token from Pi's `openai-codex` authentication instead of OpenCode auth files.
- Delegate OAuth token refresh to Pi's auth storage rather than duplicating refresh logic in the extension.
- Call the Codex usage endpoint with the refreshed Bearer token and without depending on OpenCode-specific account metadata.
- Display a compact auth-missing status when Pi Codex authentication is unavailable.
- Retry a transient Codex usage fetch failure once before keeping the last known/cached quota status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-codex-usage-footer`: Codex quota status resolution now depends on Pi `openai-codex` auth, reports missing Pi auth, and preserves cached status after a retry on transient fetch failure.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/codex-quota.ts`.
- Affected behavior: Pi footer Codex quota status, auth source selection, fetch retry behavior, and auth-missing status display.
- Dependencies: Pi extension context/model registry auth storage for resolving and refreshing the `openai-codex` access token.
- No new external package dependencies are expected.
