## Why

Codex banked rate-limit reset credits expire on a fixed date, but the Pi quota extension only displays the count (`R<n>`) without showing when each credit expires. Users with multiple banked credits have no way to know which one is closest to expiring and risk losing a reset unintentionally. Codex exposes per-credit details (`granted_at`, `expires_at`, `status`, `reset_type`) through a dedicated backend endpoint that complements the existing `/usage` endpoint. The previous change `2026-06-27-show-codex-banked-resets` deliberately suppressed expiry data because the count-only `/usage` response did not carry it; that constraint no longer applies once the dedicated endpoint is fetched.

## What Changes

- Fetch `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` alongside the existing `/usage` call, with a single retry on failure.
- Parse per-credit details from the response; filter to `status === "available"`; sort by `expires_at` ascending.
- Use the new endpoint as the source of truth for reset credit data; if it fails, no count is reported (the `rate_limit_reset_credits.available_count` field in the `/usage` response is no longer consumed).
- Replace `CodexQuotaData.bankedResetCredits: number | undefined` with `CodexQuotaData.bankedResetDetails: BankedResetDetail[] | undefined`, where `BankedResetDetail = { expiresAt, grantedAt, status }`.
- In the `/quota` command detail box, add an indented `#n` sub-line under `Resets N` for each available credit, showing the relative time to expiry (`in Nd` / `in Nh` / `expired`).
- Adjust the compact status bar rule: when a window is exhausted, show `R<n>` for `n > 0` (accent) and `R0` for `n === 0` (dim) based on `details.length`; omit `R` entirely when `details` is `undefined`.
- Persist the new field through the existing cache; no cache schema migration is needed because the new field is additive.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `quota-command`: Add display rules for per-credit expiry sub-lines in the Codex box.
- `pi-codex-usage-footer`: Replace the count-only `bankedResetCredits` model with `bankedResetDetails`; remove the scenario that explicitly forbids displaying expiry; document the new endpoint as the source of truth and its no-fallback failure mode.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/quota/`.
  - `types.ts`: remove `bankedResetCredits`, add `BankedResetDetail` and `bankedResetDetails`; drop the `rate_limit_reset_credits` field from `CodexUsageResponse`; add `CodexResetCreditsResponse`.
  - `codex.ts`: add a parallel fetch for `/rate-limit-reset-credits` with one retry; build `bankedResetDetails` from the response; fall back to `undefined` (not the count from `/usage`) on failure.
  - `status.ts`: add `formatRelativeExpiry` helper; update `formatCodexFullDetail` to emit the `Resets` row with sub-lines; update `formatCodexQuotaStatus` to use `details.length` and the new undefined/empty rules.
  - Tests: update existing assertions; add new coverage for `formatRelativeExpiry` and the parallel fetch.
- External API: new GET to `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` using the same Pi Codex bearer token; headers identical to `/usage` (`Authorization: Bearer …`, `Accept: application/json`).
- No new dependencies, commands, auth flows, or write operations.
