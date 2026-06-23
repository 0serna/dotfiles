## 1. Add in-process fetch cache in `web-fetch.ts`

- [x] 1.1 Add module-level `Map<string, { content: string; source: string; timestamp: number }>` and `CACHE_TTL_MS = 600_000` constant
- [x] 1.2 Add cache check at the top of `tryFetchContent`: if valid entry exists (not expired), return cached `{ content, source }`
- [x] 1.3 Store successful results in cache before returning from each tier in `tryFetchContent`

## 2. Simplify `http.ts` to text/plain only

- [x] 2.1 Remove `stripTags`, `replaceBlockElements`, `replaceLinks`, `replaceImages`, `decodeEntities`, `collapseLines`, `htmlToMarkdown`, `extractTitle`, and `assertHtmlContent` functions
- [x] 2.2 Update `extractViaHttp` to only process `text/plain` content-type; return `null` for HTML or other content types (change return type to `Promise<string | null>`)
- [x] 2.3 Remove `title` prefix logic — text/plain content is returned as-is

## 3. Reorder fallback chain in `web-fetch.ts`

- [x] 3.1 Reorder `tryFetchContent` tiers: GitHub → HTTP → Cloudflare → Exa
- [x] 3.2 Update fallback log events to reflect new `from`/`to` pairs: `http_fetch`→`cloudflare_markdown`, `cloudflare_markdown`→`exa_contents`
- [x] 3.3 Handle `extractViaHttp` returning `null` (content-type not text/plain): log fallback and continue to next tier

## 4. Eliminate duplicate `classifyGitHubUrl` in `github.ts`

- [x] 4.1 Change `tryGitHubFetch` signature to accept `ParsedGitHubUrl` instead of `string` URL
- [x] 4.2 Remove `classifyGitHubUrl(url)` call inside `tryGitHubFetch`, use the passed `parsed` parameter
- [x] 4.3 Update call site in `tryFetchContent` to pass the already-classified `ParsedGitHubUrl`

## 5. Add GitHub Releases support in `github.ts`

- [x] 5.1 Add `"releases"` and `"release-tag"` to `GitHubUrlType` union
- [x] 5.2 Add regex patterns: `RELEASES_RE` for `/releases`, `RELEASE_TAG_RE` for `/releases/tag/{tag}`
- [x] 5.3 Add matching branches in `classifyGitHubUrl` returning appropriate `ParsedGitHubUrl`
- [x] 5.4 Add `GitHubRelease` interface and `renderRelease(data)` function
- [x] 5.5 Add API path logic in `tryGitHubFetch`: `"releases"` → `/repos/{o}/{r}/releases/latest`, `"release-tag"` → `/repos/{o}/{r}/releases/tags/{tag}`
- [x] 5.6 Add `"releases"` and `"release-tag"` rendering branch calling `renderRelease`

## 6. Add GitHub rate-limit detection in `github.ts`

- [x] 6.1 In `tryGitHubFetch` catch block, check `err instanceof HttpResponseError && err.response.status === 403 && err.response.bodySnippet?.includes("rate limit")`
- [x] 6.2 If rate-limited, add `reason: "rate_limited"` to the `github_fetch_failure` log event

## 7. Verification

- [x] 7.1 Run ESLint on all modified files (`web-fetch.ts`, `http.ts`, `github.ts`) — no new errors
- [x] 7.2 Verify cache hit returns early without invoking any tier (manual trace or test)
- [x] 7.3 Verify HTML URL skips HTTP tier and falls through to Cloudflare
- [x] 7.4 Verify text/plain URL is served by HTTP tier without invoking Cloudflare or Exa
- [x] 7.5 Verify GitHub `/releases` URL fetches latest release via API
- [x] 7.6 Verify GitHub `/releases/tag/{tag}` URL fetches specific release via API
