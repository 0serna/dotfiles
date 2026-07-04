## 1. Type definitions

- [x] 1.1 Add `BankedResetDetail` type with `expiresAt`, `grantedAt`, `status` (unix seconds for the timestamps)
- [x] 1.2 Add `CodexResetCreditsResponse` type matching the `/rate-limit-reset-credits` payload (`available_count`, `credits[]` with snake_case fields)
- [x] 1.3 Replace `CodexQuotaData.bankedResetCredits: number | undefined` with `bankedResetDetails: BankedResetDetail[] | undefined`
- [x] 1.4 Remove the now-unused `rate_limit_reset_credits` field from `CodexUsageResponse`

## 2. Test-first: relative expiry helper

- [x] 2.1 Add failing tests for `formatRelativeExpiry` covering `expired`, hours (< 12h, including 1h minimum), days (>= 12h, rounded to nearest), and the boundary at 24h
- [x] 2.2 Implement `formatRelativeExpiry(expiresAt)` in `status.ts` so the new tests pass

## 3. Codex data layer

- [x] 3.1 Add `callCodexResetCreditsApi` helper in `codex.ts` that fetches the dedicated endpoint with the same `Authorization` + `Accept` headers and single-retry policy as the usage fetch
- [x] 3.2 Add `buildBankedResetDetails` step that populates `bankedResetDetails` by filtering the response to `status === "available"`, mapping snake_case fields to `BankedResetDetail`, and sorting by `expiresAt` ascending
- [x] 3.3 Wire the two fetches into `fetchCodexQuotaStatus` via `Promise.all`; the reset-credits fetch returning null leaves `bankedResetDetails` as `undefined` while the usage fetch still populates windows and credits
- [x] 3.4 Stop reading `rate_limit_reset_credits.available_count` from the usage response

## 4. Status bar formatters

- [x] 4.1 Update `formatCodexQuotaStatus` to derive the `R` count from `bankedResetDetails?.length`; show `R<n>` (accent) when `n > 0`, `R0` (dim) when `n === 0`, omit when `undefined`
- [x] 4.2 Update existing `codex-status.test.ts` assertions to construct `CodexQuotaData` with `bankedResetDetails` instead of `bankedResetCredits`

## 5. /quota detail formatter

- [x] 5.1 Add a `detailSubRow` helper in `status.ts` that indents the value by two spaces and pads to `DETAIL_WIDTH`
- [x] 5.2 Update `formatCodexFullDetail` to render the `Resets N` row using `bankedResetDetails.length`; render one `#n` sub-line per detail; render `Resets 0` (no sub-lines) when the array is empty; omit the row entirely when `details` is `undefined`
- [x] 5.3 Update existing `full-detail.test.ts` assertions for the new sub-line format and the empty/undefined array cases

## 6. Validation

- [x] 6.1 Run `npm test` and ensure the suite is green
- [x] 6.2 Run `npm run check` (ESLint, TypeScript, OpenSpec validation) and ensure it is green
- [x] 6.3 Run `npm run format` to keep the file tree consistent with project style
