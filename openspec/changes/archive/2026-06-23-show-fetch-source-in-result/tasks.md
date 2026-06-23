## 1. Remove `fallback` from `tryFetchContent`

- [x] 1.1 Remove `fallback: boolean` from the return type of `tryFetchContent` in `web-fetch.ts`
- [x] 1.2 Remove `fallback: result.fallback` from the `details` object in `executeWebFetch`
- [x] 1.3 Remove `fallback: true` from the HTTP fallback return in `tryFetchContent` (keep `source: "http-fallback"`)

## 2. Update `renderWebFetchResult` to display source

- [x] 2.1 Add a source-to-label mapping: `github-raw` → `github`, `github-api` → `github`, `exa` → `exa`, `cloudflare` → `cloudflare`, `http-fallback` → `http`
- [x] 2.2 Replace the `fallback` boolean logic with source label display: `${kb}KB (${label})` when source is recognized, `${kb}KB extracted` when source is missing or unrecognized
- [x] 2.3 Remove the `fallback` variable read from `result.details`

## 3. Verification

- [x] 3.1 Run ESLint on `web-fetch.ts` — no new errors
- [x] 3.2 Verify that error results still display only the error message (no source label)
- [x] 3.3 Verify that a fetch with no `source` in details falls back to `KB extracted` without a label
