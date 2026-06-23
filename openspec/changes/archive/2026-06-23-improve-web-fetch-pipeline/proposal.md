## Why

The current `web_fetch` fallback chain (GitHub → Exa → Cloudflare → HTTP) prioritizes quality and speed over cost. Exa (paid API) sits in position 2, meaning credits are consumed even when free alternatives could succeed. Additionally, the HTTP regex fallback attempts to parse all HTML with crude regex — producing garbage for JavaScript-heavy SPAs. A cost-first ordering with role-specialized layers reduces API spending and improves reliability for the common case.

## What Changes

- **Reorder fallback chain** from `GitHub → Exa → Cloudflare → HTTP` to `GitHub → HTTP → Cloudflare → Exa` (free first, free tier second, paid last)
- **BREAKING**: HTTP fallback (`extractViaHttp`) now only processes `text/plain` responses; HTML content skips HTTP and continues to Cloudflare. The HTML regex pipeline (`stripTags`, `replaceBlockElements`, `replaceLinks`, `replaceImages`, `decodeEntities`, `collapseLines`, `htmlToMarkdown`, `extractTitle`) is removed entirely
- Add in-process content cache for `web_fetch`: `Map<url, { content, source, timestamp }>` with 10-minute TTL, successes only
- Add GitHub Releases URL support: `/releases` (latest) and `/releases/tag/{tag}` patterns, using GitHub API
- Eliminate redundant `classifyGitHubUrl` call: pass `ParsedGitHubUrl` to `tryGitHubFetch` instead of re-parsing
- Add `reason: "rate_limited"` to GitHub fetch failure logs when 403 + "rate limit" body is detected

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `web-fetch`: Reorder fallback chain, specialize HTTP to text/plain only, add content cache, add GitHub releases support, improve GitHub diagnostics

## Impact

- **`web-fetch.ts`**: `tryFetchContent` reordered; cache logic added at top; `tryGitHubFetch` call signature changes to accept `ParsedGitHubUrl`
- **`http.ts`**: `extractViaHttp` simplified — remove HTML regex pipeline, keep only `text/plain` fetch; `assertHtmlContent` replaced with `text/plain`-only check
- **`github.ts`**: Add releases regex patterns, `renderRelease` function, releases API path; `tryGitHubFetch` accepts `ParsedGitHubUrl` param; rate-limit detection in catch block
- **`config.ts`**: No changes expected (existing timeouts remain valid for reordered chain)
- **`SOURCE_LABELS` in `web-fetch.ts`**: No changes — `http-fallback` and `github-api` source values remain the same
