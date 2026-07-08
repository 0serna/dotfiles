## Why

DCP currently creates temporary files in `/tmp/pi-dcp/` when pruning tool results, but the agent never reads these files back during the session. The saved files serve no functional purpose and waste disk space. Additionally, the 500-token minimum size threshold for `stale_large` pruning is unnecessarily complex—any tool result old enough should be pruned regardless of size.

## What Changes

- **Remove DCP-owned file creation**: DCP will no longer write pruned content to `/tmp/pi-dcp/` files. The `saved=` field in stubs will only reference existing bash logs when available.
- **Remove size threshold from `stale_large`**: Any tool result that meets the age threshold will be pruned, regardless of estimated token count.
- **Remove `staleLargeProtectedCount` metric**: This metric tracked results protected by the size threshold, which no longer exists.
- **Remove `PRUNE_TOKEN_THRESHOLD` constant**: No longer needed after removing size-based eligibility.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: Remove 500-token minimum size requirement from `stale_large` pruning. Remove DCP-owned file creation; only reference existing bash logs in `saved=` field.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/*`
- Affected tests: context DCP pruning tests
- No new dependencies
- No persisted session format changes; pruning remains transient context-only behavior
