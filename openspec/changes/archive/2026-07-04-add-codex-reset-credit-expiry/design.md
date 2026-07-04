## Context

The Pi quota extension lives in `dotfiles/pi/agent/extensions/quota/`. Its Codex data path currently calls a single private endpoint (`https://chatgpt.com/backend-api/wham/usage`) and surfaces:

- Rate-limit windows (`primary_window` and `secondary_window`).
- Remaining credits (`credits.balance`).
- A reset credit count (`rate_limit_reset_credits.available_count`).

The count is rendered as `R<n>` in the compact status bar (when a window is exhausted) and as `Resets N` in the `/quota` detail box. The dedicated endpoint `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` returns a richer payload with per-credit expiry, grant, and status — but it is not part of the supported Codex app-server protocol today (issues `openai/codex#28963` and `#29618` track the request to expose it). The extension already depends on the `/usage` endpoint from the same `wham/backend-api/` namespace, so adding a second private fetch does not change the trust posture.

The data model (`CodexQuotaData`) and the formatter (`status.ts`) are tightly coupled today: the count is read directly in both the compact and full-detail paths. A clean extension requires re-modelling the data into an array of credit details and deriving the count from `array.length`.

## Goals / Non-Goals

**Goals:**

- Show per-credit expiry dates in the `/quota` detail view so the user can prioritise the most urgent reset.
- Keep the status bar behavior coherent: `R<n>` (accent) when `n > 0`, `R0` (dim) when `n === 0`, and silent when the new endpoint fails.
- Keep the extension resilient: a failure of the new endpoint must not break the existing rate-limit and credits display.
- Add tests for the new helper, the parallel fetch, and the updated formatters.

**Non-Goals:**

- Persisting expiry warnings, tooltips, or other visual changes in the compact status bar.
- Redeeming reset credits (read-only extension).
- Changing auth or refresh logic for Codex.
- Surfacing non-`available` credit statuses (`redeemed`, `redeeming`, `expired`) in the UI; the filter drops them.

## Decisions

### 1. New endpoint is the sole source of reset credit data

- The new endpoint's `available_count` and the `/usage` response's `rate_limit_reset_credits.available_count` are assumed to match. If the new endpoint succeeds, we trust it; the count from `/usage` is no longer read.
- Rationale: avoids two ways to express the same fact, eliminates a fallback path that would create stale-but-displayed values, and keeps the model simple.
- Alternative considered: keep the count from `/usage` as a fallback when the new endpoint fails. Rejected because it would let a temporarily-failing new endpoint display a number that may be stale by up to one poll interval (3 min) and contradict the source-of-truth principle.

### 2. Parallel fetch with single retry, isolated failure

- `fetchCodexQuotaStatus` runs `/usage` and `/rate-limit-reset-credits` in `Promise.all`. The new fetch uses the same single-retry policy as `/usage` (calls twice on failure before giving up).
- On failure of the new endpoint, the extension builds a `CodexQuotaData` with `bankedResetDetails: undefined`. The rate-limit windows and credits are still populated from `/usage`.
- Rationale: matches the existing retry pattern, keeps the two fetches independent (latency of one does not block the other), and degrades gracefully to the previous behavior of the rate-limit and credits display.

### 3. Data model: array of credit details

- `CodexQuotaData.bankedResetCredits: number | undefined` is removed.
- `CodexQuotaData.bankedResetDetails: BankedResetDetail[] | undefined` is added, where `BankedResetDetail = { expiresAt: number; grantedAt: number; status: string }`. `expiresAt` and `grantedAt` are unix seconds; `status` is the raw API string.
- The count displayed in the status bar and full detail is `bankedResetDetails?.length` (or `0` when defined as an empty array).
- Rationale: the new endpoint exposes the detail per credit; storing only a count would force a re-fetch. Keeping `grantedAt` and `status` in the data model — even though only `expiresAt` is displayed today — preserves the full payload for future use and avoids a second pass at the API.

### 4. Display ordering and filtering

- Credits are filtered to `status === "available"` before display.
- After filtering, the list is sorted by `expiresAt` ascending (soonest first).
- Rationale: most urgent reset is the most actionable; the count is unchanged by sorting.

### 5. Relative time helper

- A new `formatRelativeExpiry(expiresAt: number): string` helper returns one of:
  - `"expired"` when `expiresAt <= now`.
  - `"in Nd"` when remaining time is >= 24h, with `N = Math.round(remainingSeconds / 86400)`.
  - `"in Nh"` when remaining time is < 24h and > 0, with `N = Math.max(1, Math.round(remainingSeconds / 3600))`.
- Rationale: matches the design discussion (round-to-nearest, days/hours only, no minutes, "expired" for past). The function is pure and easy to test in isolation.

### 6. `/quota` box layout: parent row + indented sub-lines

- The `Resets N` row uses the existing `detailRow` helper.
- Each credit becomes a sub-line `  #N in <relative>` rendered with a new `detailSubRow` helper that indents by two spaces and pads to `DETAIL_WIDTH`.
- The full layout for three credits:

  ```text
  │ Resets    3             │
  │   #1 in 30d             │
  │   #2 in 27d             │
  │   #3 in 12d             │
  ```

- Empty array (`bankedResetDetails = []`) renders `Resets 0` with no sub-lines. Undefined (`bankedResetDetails = undefined`) omits the row entirely.
- Rationale: minimal change to the existing box width (`DETAIL_WIDTH = 31`); the sub-line is short enough to fit even with the longest relative label (`in 365d` ≈ 8 chars + `#365 ` prefix).

### 7. Status bar rules

- Compact status: `R<n>` is shown only when a window is at 0% AND `bankedResetDetails` is defined. Color is `accent` for `n > 0`, `dim` for `n === 0`. Undefined `bankedResetDetails` suppresses the segment entirely.
- Rationale: preserves the existing `R0` dim behavior; matches the design discussion.

## Risks / Trade-offs

- **Private endpoint risk** → The new endpoint is in the same `wham/backend-api/` namespace already in use; breakage would affect `/usage` as well, so there is no new attack surface for that. Mitigation: keep the optional behavior — if the endpoint ever changes shape, `bankedResetDetails` becomes undefined and the UI degrades silently.
- **Stale count when the new endpoint fails** → A user who briefly sees `R<n>` in the status bar and then a transient failure of the new endpoint would lose the segment entirely. Mitigation: the poll interval is 3 min; the next successful refresh restores it.
- **Time-zone / clock skew** → `formatRelativeExpiry` uses local `Date.now()`. If the user's system clock is off, expiry labels are off too. Mitigation: same risk already exists for `formatResetTime`; not new.
- **Box width pressure** → With many credits, the box grows downward but never overflows horizontally. Acceptable because `/quota` is an explicit command, not the status bar.
