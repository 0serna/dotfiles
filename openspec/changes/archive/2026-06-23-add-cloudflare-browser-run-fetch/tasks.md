## 1. Configuration constants

- [x] 1.1 Add `CLOUDFLARE_TIMEOUT_MS = 30_000` and `CLOUDFLARE_MARKDOWN_URL` template constant to `pi/agent/extensions/web-search/config.ts`

## 2. Cloudflare Browser Run module

- [x] 2.1 Create `pi/agent/extensions/web-search/cloudflare.ts` with `tryCloudflareMarkdown(url, toolCallId): Promise<string | null>` function
- [x] 2.2 Implement credentials gating: return `null` immediately if `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` env vars are not set
- [x] 2.3 Implement in-process quota-exhausted flag: module-scoped boolean, checked at function entry, set when quota 429 is received
- [x] 2.4 Implement the Browser Run `/markdown` POST request with `AbortController` (30s timeout), `gotoOptions: { waitUntil: "networkidle0" }`, and `rejectResourceTypes: ["image", "font", "stylesheet"]`
- [x] 2.5 Implement 429 response handling: distinguish quota exhaustion ("Browser time limit exceeded" in response body) from transitory rate limit; set quota flag for quota exhaustion; fall through to HTTP regex fallback on any 429 without retrying
- [x] 2.6 Implement response parsing: extract `result` field from `{ success, result }` JSON response; return `null` if empty or `success` is false
- [x] 2.7 Add `logWebToolEvent` calls for success (`cloudflare_markdown_success`), failure (`cloudflare_markdown_failure`), and quota skip (`cloudflare_markdown_skipped`) using the same pattern as `exa.ts`

## 3. Integrate into fallback chain

- [x] 3.1 Import `tryCloudflareMarkdown` in `pi/agent/extensions/web-search/web-fetch.ts`
- [x] 3.2 Insert Cloudflare eslabón in `tryFetchContent()` between Exa and HTTP fallback, with fallback logging via `logWebToolEvent("web_fetch_fallback", ...)` consistent with existing eslabones
- [x] 3.3 Return `source: "cloudflare"` in the result details when Browser Run succeeds

## 4. Testing and validation

- [x] 4.1 Verify silent skip when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are unset (existing behavior unchanged)
- [x] 4.2 Verify successful extraction from a JS-heavy site (e.g., a React SPA) with credentials set
- [x] 4.3 Verify fallback to HTTP regex when Browser Run returns an error or timeout
- [x] 4.4 Verify quota-exhausted flag prevents subsequent calls after a quota 429
- [x] 4.5 Verify rate-limit 429 falls through to HTTP regex fallback without retrying
