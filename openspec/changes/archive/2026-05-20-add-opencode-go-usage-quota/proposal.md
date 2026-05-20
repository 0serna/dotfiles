## Why

Pi already displays compact Codex quota headroom, but the default working provider is now OpenCode Go and its dashboard exposes separate rolling, weekly, monthly, and dollar-balance usage data. Showing both Codex Plus and OpenCode Go usage in the footer gives an always-visible quota view without switching to the OpenCode web dashboard.

## What Changes

- Extend the existing Pi quota footer to fetch OpenCode Go usage from the OpenCode dashboard using a workspace ID and auth cookie provided through environment variables.
- Parse OpenCode Go dashboard hydration data for rolling, weekly, monthly usage windows, reset timers, and dollar balance.
- Fetch Codex Plus quota and OpenCode Go quota in parallel on the existing polling cadence.
- Replace the internal status/cache/logger naming with `usage-quota` to reflect the multi-provider footer status.
- Display both provider groups in one compact footer status string, including provider prefixes, OpenCode Go window percentages, and Go dollar balance.
- Display a compact provider error indicator when one provider fails while preserving the other provider's visible data.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-codex-usage-footer`: Extends the Codex-only quota footer behavior into a multi-provider usage quota footer that includes OpenCode Go dashboard usage.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/codex-quota.ts`.
- Runtime configuration: requires `OPENCODE_GO_AUTH_COOKIE` and `OPENCODE_GO_WORKSPACE_ID` for OpenCode Go dashboard scraping.
- Network access: adds authenticated GET requests to `https://opencode.ai/workspace/{workspaceId}/go` in addition to the existing Codex `wham/usage` request.
- Local state: cache and log names move from Codex-specific names to `usage-quota` names.
