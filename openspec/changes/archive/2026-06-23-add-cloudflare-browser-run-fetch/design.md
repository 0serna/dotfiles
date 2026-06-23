## Context

The `web_fetch` tool in the `web-search` extension uses a progressive fallback chain to extract readable content from URLs:

```
GitHub → Exa Contents → HTTP regex fallback
```

The HTTP regex fallback (`http.ts`) performs a raw `fetch()` and converts HTML to Markdown using regex transformations. It cannot execute JavaScript, so SPAs and JS-heavy sites return empty or incomplete content. Exa also struggles with some dynamic sites.

Cloudflare Browser Run Quick Actions offers a `/markdown` REST endpoint that launches a headless Chrome instance, fully renders the page (including JS), and returns Markdown. This fits naturally as an intermediate fallback between Exa and the regex approach.

The extension codebase follows consistent patterns: each fallback source is a separate module (`github.ts`, `exa.ts`, `http.ts`) exposing a function that returns `string | null`, uses `AbortController` for timeouts, and logs via `logWebToolEvent` with `failureDetails` from `shared/diagnostics.ts`.

## Goals / Non-Goals

**Goals:**

- Extract readable Markdown from JavaScript-heavy sites that Exa and the HTTP regex fallback cannot handle
- Integrate as a non-disruptive fallback eslabón — existing behavior is preserved when Cloudflare credentials are absent or quota is exhausted
- Follow the exact module patterns already established in the `web-search` extension

**Non-Goals:**

- Browser session management (Puppeteer, Playwright, CDP) — only stateless Quick Actions
- Workers binding integration — REST API only, no Worker deployment required
- Replacing the existing HTTP regex fallback — it remains as the last resort
- URL content-type filtering before sending to Browser Run
- Screenshot, PDF, or snapshot capture — only `/markdown` extraction

## Decisions

### Decision 1: REST API Quick Actions, not Workers binding

**Choice**: Use the REST API (`POST https://api.cloudflare.com/client/v4/accounts/<accountId>/browser-rendering/markdown`) with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

**Rationale**: The Workers binding requires deploying a Cloudflare Worker and using `wrangler`. The REST API is a single HTTP POST from any environment — identical to how Exa is called. No infrastructure, no deployment, no extra dependencies.

**Alternative considered**: Workers binding via `env.BROWSER.quickAction()`. Rejected because it requires a Worker deployment and `--remote` mode for local development, adding operational complexity for no functional benefit in this use case.

### Decision 2: Position in fallback chain — after Exa, before HTTP regex

**Choice**: `GitHub → Exa → Cloudflare Browser Run → HTTP regex`

**Rationale**: Exa is faster (~1-2s) and doesn't consume browser time. Browser Run is slower (~3-10s) and consumes free-tier quota. Browser Run should only activate when Exa has already failed, which is the most likely scenario for JS-heavy sites. The HTTP regex remains as the ultimate fallback when Cloudflare credentials are missing or quota is exhausted.

**Alternative considered**: Browser Run before Exa. Rejected because it would add 3-10s latency to every non-GitHub fetch, including simple static pages that Exa handles fine.

### Decision 3: `networkidle0` wait strategy with resource blocking

**Choice**: `gotoOptions: { waitUntil: "networkidle0" }` + `rejectResourceTypes: ["image", "font", "stylesheet"]`

**Rationale**: Browser Run is already a fallback (Exa failed), so the site is likely dynamic and needs full JS rendering. `networkidle0` ensures all network activity settles before extraction. Blocking images, fonts, and stylesheets reduces load time and browser-time consumption without affecting Markdown content (which is text-only).

**Alternative considered**: `domcontentloaded` for speed. Rejected because it may return incomplete content on SPAs, defeating the purpose of using a headless browser.

### Decision 4: Credentials gating — silent skip when env vars are absent

**Choice**: If `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` are not set, `tryCloudflareMarkdown()` returns `null` immediately without logging an error.

**Rationale**: Matches the pattern of `tryGitHubFetch()` returning `null` for non-GitHub URLs. Browser Run is an opt-in enhancement; users without Cloudflare credentials should experience zero behavior change.

### Decision 5: Quota exhaustion caching (in-process, session-scoped)

**Choice**: When Browser Run returns HTTP 429 with a quota-exceeded message, set an in-process boolean flag (`cloudflareQuotaExhausted`) that causes all subsequent `tryCloudflareMarkdown()` calls to return `null` immediately for the remainder of the process lifetime.

**Rationale**: The free tier limit (10 min/day) resets at UTC midnight. Once exhausted, every subsequent call will fail with the same 429, wasting ~1-2s per call on the HTTP roundtrip. Caching the exhausted state avoids this overhead. The flag is module-scoped and resets naturally when the pi process restarts.

**Distinction from rate-limit 429**: A transitory rate-limit 429 (1 request per 10s on free tier) is handled differently — see Decision 6.

### Decision 6: No retry on rate-limit 429

**Choice**: When Browser Run returns HTTP 429 that is a rate limit (not quota exhaustion), fall through to the HTTP regex fallback immediately without retrying.

**Rationale**: The `Retry-After` header value is used directly as the sleep duration with no upper bound, which could block the tool for an unacceptable amount of time. Every other network wait in the codebase is capped (10–30s timeouts). Rather than add a cap and retry logic, the simpler and safer approach is to skip Browser Run on any 429 and let the HTTP regex fallback handle the request.

**How to distinguish quota vs rate limit**: The quota-exceeded response includes "Browser time limit exceeded" in the error message. The rate-limit response does not.

### Decision 7: 30-second AbortController timeout

**Choice**: `CLOUDFLARE_TIMEOUT_MS = 30_000`

**Rationale**: `networkidle0` on complex sites can take 10-20s. The browser itself has a 60s timeout. 30s gives enough headroom for rendering while preventing indefinite hangs. If the timeout fires, the fallback chain continues to the HTTP regex.

## Risks / Trade-offs

- **[Free tier exhaustion in long sessions]** → Mitigated by in-process quota cache that skips Browser Run after first quota 429. HTTP regex fallback remains functional.
- **[Latency: up to ~30s worst case]** → Browser Run (30s timeout). Acceptable because this is already a last-resort fallback after Exa failed.
- **[Bot detection blocking]** → Browser Run always identifies as a bot via non-configurable headers. Some sites may block it. No mitigation needed — the HTTP regex fallback handles this case.
- **[Cloudflare API token security]** → Token is read from environment variable, never logged. Same pattern as `EXA_API_KEY`.
- **[In-process cache not persistent]** → If pi restarts, the quota-exhausted flag resets and one call will hit the 429 again before re-caching. This is one wasted HTTP call per restart — acceptable.
