## Context

The `web_fetch` extension currently uses a 4-tier fallback chain ordered as GitHub → Exa → Cloudflare → HTTP. This ordering was established incrementally: GitHub was added as an optimization for recognized URLs, Exa was the original content source, Cloudflare was inserted as a JS-rendering fallback, and HTTP regex was the original last resort. The ordering was never revisited as a whole.

The chain also has a quality issue: the HTTP regex fallback (`extractViaHttp`) attempts to parse all HTML with crude regex transformations. For JavaScript-heavy single-page applications, this produces garbage content (e.g., `<div id="root"></div>` cleaned to near-empty text) that passes as a successful result, blocking the more capable Cloudflare tier from running.

Additionally, the LLM frequently re-fetches the same URL 2-3 times within a conversation, re-running the entire chain each time.

## Goals / Non-Goals

**Goals:**

- Reorder the fallback chain to prioritize free tiers (GitHub, HTTP) over paid tiers (Exa)
- Specialize HTTP to `text/plain` only, removing the HTML regex pipeline that produces low-quality output for dynamic pages
- Add in-process caching to avoid redundant retrieval for repeated fetches
- Add GitHub Releases support (latest and by-tag) to the GitHub optimization tier
- Improve GitHub failure diagnostics with rate-limit detection
- Eliminate redundant URL classification in the GitHub tier

**Non-Goals:**

- Adding `GITHUB_TOKEN` support (60 req/hour without token is accepted)
- Adding GitHub Gists support
- Detecting content quality of HTTP responses to decide whether to continue
- Parallelizing fallback tiers
- Persistent cache across sessions
- Modifying `web_search` (which uses Exa Search, not the fetch chain)

## Decisions

### D1: Reorder to GitHub → HTTP → Cloudflare → Exa (cost-first)

**Decision:** Reorder the chain so free tiers run first, free-tier (Cloudflare) second, and paid (Exa) last.

**Alternatives considered:**

- Keep current order (quality-first): Exa is fast and produces good content, but consumes paid credits even when free alternatives would succeed.
- Parallel execution of HTTP + Cloudflare: Would add complexity and waste Cloudflare quota on pages where HTTP suffices.

**Rationale:** The most common `web_fetch` targets in a coding agent are: GitHub URLs (handled by tier 1), raw text files (handled by HTTP `text/plain`), and documentation/blog pages (need Cloudflare for JS rendering). Exa is valuable as a last resort for pages that Cloudflare can't render (timeout, quota exhausted, no credentials) but shouldn't be the default consumption path.

### D2: HTTP fallback restricted to `text/plain` only

**Decision:** `extractViaHttp` will only process responses with `text/plain` content-type. HTML responses (`text/html`, `application/xhtml+xml`) will return `null`, allowing the chain to continue to Cloudflare.

**Alternatives considered:**

- Content length threshold (skip if < N chars): Fragile — some valid pages have short content. Adds magic numbers.
- Always run HTTP then Cloudflare regardless: Wastes an HTTP request and can return garbage that masks the better Cloudflare result.
- Keep HTML regex as a final fallback after Exa: Rejected by user — error is cleaner than low-quality content.

**Rationale:** HTML regex is fundamentally unreliable for modern web pages. Cloudflare's `/markdown` endpoint produces superior output by rendering the page in a real browser. For `text/plain` (raw files, CSVs, configs), regex is unnecessary — the content is already readable. This specialization makes each tier do what it's good at.

### D3: Remove HTML regex pipeline from `http.ts`

**Decision:** Delete `stripTags`, `replaceBlockElements`, `replaceLinks`, `replaceImages`, `decodeEntities`, `collapseLines`, `htmlToMarkdown`, `extractTitle`, and `assertHtmlContent`. `extractViaHttp` becomes a simple fetch + `text/plain` validation + return text.

**Rationale:** With D2, these functions have no callers. Keeping dead code violates YAGNI. If HTML regex is needed in the future, it can be re-added with a clear purpose.

### D4: In-process cache (Map, 10-min TTL, successes only)

**Decision:** Module-level `Map<string, { content: string; source: string; timestamp: number }>` in `web-fetch.ts`. Checked at the top of `tryFetchContent` before any tier runs. Only successful results are stored. No size limit, no eviction — process termination clears the cache.

**Alternatives considered:**

- LRU with max entries: Adds complexity for a non-problem (<30 URLs per session is typical).
- Cache errors too: Errors are often transitory (rate limits, timeouts). Caching them would prevent retries that might succeed.
- Persistent cache (file/SQLite): Out of scope — adds I/O complexity and stale data risk across sessions.
- TTL of 5 min: User chose 10 min. The LLM typically re-fetches within 2-3 minutes, so either is sufficient.

**Rationale:** The cache is purely an optimization to avoid redundant work within a single session. It doesn't need to be sophisticated.

### D5: GitHub Releases support

**Decision:** Add two URL patterns to `classifyGitHubUrl`:

- `https://github.com/{owner}/{repo}/releases` → type `"releases"`, API path `/repos/{owner}/{repo}/releases/latest`
- `https://github.com/{owner}/{repo}/releases/tag/{tag}` → type `"release-tag"`, API path `/repos/{owner}/{repo}/releases/tags/{tag}`

Add `renderRelease(data)` to format release name, tag, body, assets count, and URL. Source: `"github-api"`.

**Rationale:** Releases are common targets for coding agents (changelogs, version info). The GitHub API is public and requires no authentication. `/releases` without a tag returns only the latest release to stay token-efficient.

### D6: Eliminate duplicate `classifyGitHubUrl` call

**Decision:** `tryGitHubFetch` currently calls `classifyGitHubUrl(url)` internally, while `tryFetchContent` also calls it to check `gitHubType`. Change `tryGitHubFetch` signature to accept `ParsedGitHubUrl` instead of re-parsing.

**Rationale:** Pure cleanup. The regex is cheap but the duplication is unnecessary code.

### D7: GitHub rate-limit detection in logs

**Decision:** In the `catch` block of `tryGitHubFetch`, check if `err instanceof HttpResponseError && err.response.status === 403 && err.response.bodySnippet?.includes("rate limit")`. If so, add `reason: "rate_limited"` to the `github_fetch_failure` log event.

**Rationale:** Without a `GITHUB_TOKEN`, the 60 req/hour limit is reachable in active sessions. The `reason` field gives diagnostic visibility without changing behavior — the fallback chain still falls through to the next tier.

## Risks / Trade-offs

- [Cloudflare quota consumption increases] → Cloudflare moves from position 3 to position 3 but now receives all HTML traffic that previously Exa intercepted. The cache (D4) mitigates repeated fetches. When quota exhausts, Exa (paid) takes over.
- [HTML pages without Cloudflare credentials or Exa crawl = error] → Previously HTTP regex would produce low-quality but non-empty content. Now the result is a clean error. Accepted tradeoff: better to fail honestly than return garbage.
- [Latency increase for static HTML] → A static HTML page that Exa previously served in ~1-2s now goes through HTTP (skip, ~1s) → Cloudflare (~2-30s). Accepted: cost savings justify the latency, and the cache eliminates repeats.
- [Releases with very long bodies] → Some releases have extensive changelogs. No truncation is applied. The LLM can handle long content, and truncation would lose information. Accepted as-is.
