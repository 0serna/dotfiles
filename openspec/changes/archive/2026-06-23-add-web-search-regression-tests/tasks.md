## 1. Fix existing GitHub tests

- [x] 1.1 Update `github.test.ts`: change the `/releases` assertion from `toBe("unsupported")` to `toBe("releases")` with `owner`/`repo` checks
- [x] 1.2 Add test for `/releases/tag/v1.0` URL → type `"release-tag"` with `owner`, `repo`, and `tag` assertions
- [x] 1.3 Remove `/releases` from the "unsupported" test case list (keep `commits/main`, `wiki` as unsupported)

## 2. web_search orchestration tests

- [x] 2.1 Create `web-search.test.ts` with `vi.mock` for `./exa.ts` and `./tavily.ts`, exporting controlled `callExaSearch` and `callTavilySearch` as `vi.fn()` stubs
- [x] 2.2 Test empty/whitespace query → `isError: true`
- [x] 2.3 Test Exa-only path: `TAVILY_API_KEY` unset → `callExaSearch` called with `numResults=undefined`, `callTavilySearch` not called, result has Exa-formatted text
- [x] 2.4 Test Tavily-only path: `EXA_API_KEY` unset → `callTavilySearch` called, `callExaSearch` not called, result has merged-format text
- [x] 2.5 Test parallel path: both keys set → `callExaSearch` called with `numResults=2`, `callTavilySearch` called, result has interleaved content
- [x] 2.6 Test partial success: Exa rejects, Tavily returns results → `isError: false`, result contains Tavily results
- [x] 2.7 Test partial success: Tavily returns null, Exa returns results → `isError: false`, result contains Exa results
- [x] 2.8 Test both fail: Exa rejects, Tavily returns null → `isError: true`
- [x] 2.9 Test both return empty arrays → `isError: true`
- [x] 2.10 Test URL dedup: overlapping URL appears once, first occurrence (Exa) wins
- [x] 2.11 Test `details.providers` present when both contribute, absent when only one contributes

## 3. web_fetch pipeline tests

- [x] 3.1 Create `web-fetch.test.ts` with `vi.mock` for `./github.ts`, `./http.ts`, `./cloudflare.ts`, `./exa.ts`, exporting controlled stubs as `vi.fn()`
- [x] 3.2 Test invalid URL (non-HTTP, empty) → `isError: true`
- [x] 3.3 Test GitHub success: `tryGitHubFetch` returns content → `extractViaHttp`, `tryCloudflareMarkdown`, `callExaContents` not called, `details.source` is GitHub source
- [x] 3.4 Test HTTP success: non-GitHub URL, `extractViaHttp` returns content → `tryCloudflareMarkdown`, `callExaContents` not called, `details.source` is `"http-fallback"`
- [x] 3.5 Test Cloudflare success: HTTP null, `tryCloudflareMarkdown` returns content → `callExaContents` not called, `details.source` is `"cloudflare"`
- [x] 3.6 Test all tiers fail → `isError: true` with descriptive error
- [x] 3.7 Test cache hit: call `executeWebFetch` twice with same URL → second call returns cached content, no tier module called again

## 4. Verification

- [x] 4.1 Run `npx vitest run dotfiles/pi/agent/extensions/web-search/` — all tests pass
- [x] 4.2 Run `npm run check` — all 4 tools report PASS (eslint, tsc, fallow, openspec)
- [x] 4.3 Verify `github.test.ts` no longer fails on `/releases` assertion
