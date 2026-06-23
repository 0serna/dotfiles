## Context

`web_search` currently uses Exa as its sole search provider. The tool calls `callExaSearch`, formats results as highlights + sources list, and returns to the LLM. There is no fallback or parallel provider. Tavily offers a Search API with a free tier of 1,000 credits/month (1 credit per `basic` search) and no credit card requirement.

The existing `web-search.ts` module is compact: `executeWebSearch` calls Exa, `formatSearchResponse` builds the text, and `renderWebSearchResult` shows a source count. The renderer reads `details.sourceCount`.

## Goals / Non-Goals

**Goals:**

- Add Tavily as a parallel search provider alongside Exa.
- Execute both searches concurrently via `Promise.allSettled`.
- Merge results with deduplication by URL and interleaving by provider ranking.
- Present provider-transparent results to the LLM.
- Show per-provider counts in the UI renderer.
- Handle partial success gracefully.
- Skip Tavily silently when `TAVILY_API_KEY` is absent.

**Non-Goals:**

- Caching search results (deferred).
- Using Tavily's `include_answer` feature.
- Using Tavily's Extract, Crawl, or Map endpoints.
- Adding Tavily to `web_fetch` (separate concern).
- Configurable provider selection or result counts per provider.

## Decisions

### D1: Parallel execution via `Promise.allSettled`

Use `Promise.allSettled` to run Exa and Tavily concurrently. This ensures neither provider blocks the other and partial results are available if one fails.

**Alternative considered:** Sequential with fallback (Exa first, Tavily only if Exa fails). Rejected because the user explicitly wants parallel search for result diversity, not fallback.

### D2: Request 2 results from each provider

Exa: set `numResults=2` in the search body. Tavily: set `max_results=2` in the request body.

**Alternative considered:** Request 3+ from each to backfill duplicates. Rejected to keep the design simple and respect the user's "2 from each" requirement.

### D3: Deduplicate by URL

After collecting results from both providers, deduplicate by URL (case-insensitive). The first occurrence in interleave order wins. The final result count may be less than 4.

### D4: Interleave preserving internal ranking

Merge order: `Exa[0], Tavily[0], Exa[1], Tavily[1]`. This avoids biasing toward one provider and gives balanced diversity. Each provider returns results already ranked by relevance.

**Alternative considered:** Exa-first or Tavily-first ordering. Rejected because it biases the merged list toward one provider.

### D5: Provider-transparent output to LLM

The text content returned to the LLM contains only title, URL, and snippet per result — no provider labels. Format:

```
1. [Title](url)
   snippet text

2. [Title](url)
   snippet text
```

### D6: Renderer shows per-provider counts

`details` includes `sourceCount` (unique total) and `providers` object with per-provider received counts. Renderer displays: `3 sources (2 exa, 2 tavily)`.

When only one provider is active (e.g., Tavily absent), the renderer shows just the count without per-provider breakdown: `2 sources`.

### D7: Tavily search parameters

- `search_depth`: `"basic"` (1 credit, balanced)
- `max_results`: `2`
- `include_answer`: `false`
- `include_raw_content`: `false`
- `include_usage`: `true` (for diagnostics)
- Authentication: `Authorization: Bearer <TAVILY_API_KEY>`

### D8: Tavily module pattern follows `exa.ts`

The `tavily.ts` module mirrors `exa.ts` structure: AbortController timeout, `logWebToolEvent` for success/failure, `failureDetails` for errors, `HttpResponseError` for non-2xx responses.

### D9: Tavily timeout

15 seconds via AbortController, matching Exa's timeout. Both run in parallel so total latency is max(Exa, Tavily) ≈ 15s worst case.

### D10: Exa `numResults` override

Currently `callExaSearch` uses `DEFAULT_NUM_RESULTS` (5) from `buildSearchBody`. For parallel search, the `executeWebSearch` caller needs to request only 2 results from Exa. Add an optional `numResults` parameter to `callExaSearch` that overrides the default.

### D11: Snippet extraction per provider

- Exa: use `highlights?.[0]` (existing behavior).
- Tavily: use `content` field (NLP summary per URL, max ~500 chars at `basic` depth).
- Both fall back to `"No summary text available."` if empty.

## Risks / Trade-offs

- [Deduplication reduces result count] → Accepted; user explicitly preferred dedup over maintaining exactly 4 results.
- [Interleaving mixes quality levels] → Accepted; Exa and Tavily have different ranking algorithms. Interleaving provides diversity over purity.
- [Doubled API calls per search] → Accepted; 1 Exa call + 1 Tavily credit per search. Free tier covers 1,000 Tavily searches/month.
- [Tavily free tier exhaustion] → Tavily returns 429 when credits are exhausted; this is handled as a provider failure, falling back to Exa-only for that search. No in-process quota caching (unlike Cloudflare) since the free tier is generous and reset is monthly.
- [Exa `numResults` change from 5 to 2] → Only affects parallel mode. When Tavily is absent, Exa still uses `DEFAULT_NUM_RESULTS` (5) to preserve current behavior.
