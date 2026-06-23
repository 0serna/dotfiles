## Why

The `web_fetch` extension's HTTP fallback uses regex-based HTML-to-Markdown conversion that cannot execute JavaScript. Single-page applications and JavaScript-heavy sites return empty or incomplete content when both GitHub optimization and Exa extraction fail. Cloudflare Browser Run Quick Actions provide a headless Chrome endpoint (`/markdown`) that fully renders pages before extracting Markdown, filling this gap without requiring infrastructure deployment.

## What Changes

- Add a new fallback eslabón in the `web_fetch` chain between Exa and the HTTP regex fallback, using Cloudflare Browser Run's `/markdown` Quick Action REST endpoint
- The new eslabón launches a headless Chrome instance via Cloudflare's API, waits for full network idle (`networkidle0`), blocks non-essential resources (images, fonts, stylesheets), and returns rendered Markdown
- If `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` environment variables are not set, the eslabón is skipped silently (no error, no log noise)
- Rate limit responses (HTTP 429 transitory) fall through to the HTTP regex fallback without retrying
- Quota-exhausted responses (HTTP 429 daily limit) are cached in-process so subsequent calls skip Browser Run for the remainder of the session
- New `cloudflare.ts` module in the `web-search` extension following the same patterns as `exa.ts` (AbortController, `logWebToolEvent`, `failureDetails`)
- New config constants in `config.ts` for the Cloudflare API URL and timeout (30s)
- The `web_fetch` tool's `tryFetchContent` function is modified to insert the Cloudflare eslabón in the fallback chain

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-fetch`: The fallback chain gains a new eslabón (Cloudflare Browser Run `/markdown`) between Exa and the HTTP regex fallback. The existing requirement "Fetch content from a single URL" changes to reflect a four-tier fallback: GitHub → Exa → Cloudflare Browser Run → HTTP regex. A new requirement covers Cloudflare-specific behavior (credentials gating, quota caching, rate-limit fall-through, resource blocking).

## Impact

- **New file**: `pi/agent/extensions/web-search/cloudflare.ts` (~60 lines)
- **Modified files**:
  - `pi/agent/extensions/web-search/web-fetch.ts` — insert Cloudflare eslabón in `tryFetchContent`
  - `pi/agent/extensions/web-search/config.ts` — add `CLOUDFLARE_TIMEOUT_MS` and API URL constants
- **Environment variables**: `CLOUDFLARE_API_TOKEN` (Browser Rendering - Edit permission), `CLOUDFLARE_ACCOUNT_ID` — both optional
- **Dependencies**: No new npm dependencies; uses `fetch` (already available in the runtime)
- **External service**: Cloudflare Browser Run Quick Actions REST API (`api.cloudflare.com`)
- **Cost**: Free tier allows 10 min/day of browser time (~120 fetches at ~5s each). Fallback to regex HTTP ensures continued operation when quota is exhausted
