## Why

Codex now exposes banked rate-limit reset credits, but the Pi quota footer only shows quota windows and remaining purchased credits. Showing the reset count gives the user a compact view of available recovery options without opening Codex account UI.

## What Changes

- Parse Codex banked reset credits from the existing Codex usage response.
- Display available banked resets in the Codex quota status as `R<n>`.
- Place the reset segment before the existing credits segment `C<n>`.
- Show `R0` only when the backend explicitly reports zero available resets.
- Omit the reset segment when the backend does not provide reset-credit data.
- Do not infer or display expiration, eligibility, or reset history.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-codex-usage-footer`: Add compact display behavior for Codex banked rate-limit reset credits.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/quota/`.
- Affected status output: the `CODEX` segment of the Pi quota footer.
- External API dependency: existing `https://chatgpt.com/backend-api/wham/usage` response shape, specifically `rate_limit_reset_credits.available_count`.
- No new dependencies, commands, auth flows, or write operations.
