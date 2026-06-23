## 1. Config and types

- [x] 1.1 Add Tavily constants to `config.ts`: `TAVILY_SEARCH_URL = "https://api.tavily.com/search"`, `TAVILY_TIMEOUT_MS = 15_000`
- [x] 1.2 Add `TavilySearchResponse` type to `types.ts`: `results: Array<{ title?: string; url?: string; content?: string; score?: number }>`, `usage?: { credits?: number }`, `response_time?: number`

## 2. Tavily module

- [x] 2.1 Create `tavily.ts` with `callTavilySearch(query, toolCallId?)` following `exa.ts` pattern: AbortController timeout, `logWebToolEvent` for success/failure, `failureDetails` for errors, `HttpResponseError` for non-2xx
- [x] 2.2 Implement `getApiKeyOrThrow()` for `TAVILY_API_KEY` (throw if absent)
- [x] 2.3 Build request body: `query`, `max_results: 2`, `search_depth: "basic"`, `include_answer: false`, `include_raw_content: false`, `include_usage: true`
- [x] 2.4 Use `Authorization: Bearer <key>` header (not `x-api-key` like Exa)
- [x] 2.5 Log `tavily_search_success` with query, results count, elapsedMs, and credits used
- [x] 2.6 Log `tavily_search_failure` with query, elapsedMs, and `failureDetails(err)`
- [x] 2.7 Return `TavilySearchResponse | null` (catch all errors, return null on failure)

## 3. Exa module adjustments

- [x] 3.1 Add optional `numResults?: number` parameter to `callExaSearch` signature
- [x] 3.2 In `buildSearchBody`, use `numResults ?? DEFAULT_NUM_RESULTS` instead of hardcoded `DEFAULT_NUM_RESULTS`

## 4. Merge and format logic

- [x] 4.1 Define `SearchResult` interface in `types.ts`: `{ title: string; url: string; snippet: string; provider: "exa" | "tavily" }`
- [x] 4.2 Create `mergeResults(exaResults, tavilyResults)` function in `web-search.ts` that interleaves by ranking index (Exa[0], Tavily[0], Exa[1], Tavily[1]) and deduplicates by URL (case-insensitive, first occurrence wins)
- [x] 4.3 Create `formatMergedResults(results: SearchResult[])` that outputs provider-transparent format: numbered list with `[Title](url)` and snippet below each, no provider labels
- [x] 4.4 Map Exa results to `SearchResult`: title from `r.title`, url from `r.url`, snippet from `r.highlights?.[0] ?? ""`, provider `"exa"`
- [x] 4.5 Map Tavily results to `SearchResult`: title from `r.title`, url from `r.url`, snippet from `r.content ?? ""`, provider `"tavily"`

## 5. Rewrite executeWebSearch

- [x] 5.1 Keep empty-query validation as-is
- [x] 5.2 Check `TAVILY_API_KEY` presence; if absent, run Exa-only path with `numResults=undefined` (uses default 5) and existing `formatSearchResponse`
- [x] 5.3 When both keys present, run `Promise.allSettled` with `callExaSearch(query, 2)` and `callTavilySearch(query)`
- [x] 5.4 Extract successful results from `allSettled` fulfilled values; treat rejected/failed as null
- [x] 5.5 If both fail, return error `"Search failed"`
- [x] 5.6 If one succeeds, use its results only
- [x] 5.7 If both succeed, call `mergeResults` to interleave + dedupe
- [x] 5.8 Format with `formatMergedResults` and return
- [x] 5.9 Populate `details` with `sourceCount` (unique count) and `providers` object: `{ exa: <received>, tavily: <received> }` when both providers contributed; only `sourceCount` when single provider

## 6. Renderer update

- [x] 6.1 In `renderWebSearchResult`, check `details.providers` — if present, format as `N sources (X exa, Y tavily)` using `sourceCount` for N and provider counts for X/Y
- [x] 6.2 If `details.providers` absent but `sourceCount > 0`, display `N sources` (existing behavior)
- [x] 6.3 If `sourceCount` is 0 or absent, display `"search error"` (existing behavior)

## 7. Verification

- [x] 7.1 ESLint passes clean on all modified files
- [x] 7.2 Manual test: with both API keys set, verify `web_search` returns interleaved deduplicated results with provider-transparent format
- [x] 7.3 Manual test: with `TAVILY_API_KEY` unset, verify Exa-only search works with default result count
- [x] 7.4 Manual test: with `EXA_API_KEY` unset but `TAVILY_API_KEY` set, verify Tavily-only search works
- [x] 7.5 Verify renderer shows `N sources (X exa, Y tavily)` when both providers active, `N sources` when single
- [x] 7.6 Verify log file contains `tavily_search_success` and `tavily_search_failure` events
