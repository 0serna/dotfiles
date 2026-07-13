## Context

The Pi `web-search` extension exposes `web_search` and `web_fetch`. Search currently orchestrates Exa and Tavily, while fetch uses the ordered retrieval cascade GitHub → direct HTTP → Cloudflare Browser Run → Exa Contents. Firecrawl Cloud v2 provides Search and Scrape REST endpoints, supports keyless basic usage, and accepts an optional bearer API key for the free account allowance and higher limits.

The integration must preserve the public tool interfaces, use native `fetch` rather than an SDK, and follow the extension's existing timeout, diagnostics, partial-success, and retrieval-adapter patterns.

## Goals / Non-Goals

**Goals:**

- Run Firecrawl Search as a peer alongside every configured Exa and Tavily search.
- Use Firecrawl Scrape as the third fetch tier, before Cloudflare and Exa.
- Support both keyless and `FIRECRAWL_API_KEY` authenticated cloud requests.
- Preserve partial success and deterministic URL-deduplicated provider interleaving.
- Make Firecrawl contribution and retrieval source visible in tool renderers and logs.

**Non-Goals:**

- Supporting self-hosted Firecrawl or a configurable base URL.
- Adding Firecrawl Crawl, Map, Extract, Interact, or Agent endpoints.
- Adding Jina Reader, credit accounting, quota warnings, retries, or backoff.
- Changing `web_search` or `web_fetch` parameters.
- Introducing the Firecrawl SDK.

## Decisions

### Use one Firecrawl REST module for Search and Scrape

Add `firecrawl.ts` with shared request/authentication behavior and separate typed functions for Search and Scrape. Both call fixed Firecrawl Cloud v2 endpoints with native `fetch`, a common timeout, JSON parsing, structured diagnostics, and optional `Authorization: Bearer ${FIRECRAWL_API_KEY}`.

This avoids an SDK dependency and keeps provider-specific wire formats outside orchestration modules. Separate search and scrape modules were considered, but would duplicate authentication, timeout, response parsing, and error handling for a small integration.

### Always include Firecrawl Search as an eligible peer

Firecrawl Search is eligible even without an API key because keyless basic usage is supported. Exa and Tavily remain eligible only when their respective keys are configured. Eligible providers run concurrently with `Promise.allSettled`; a provider failure contributes no results, and the operation fails only when every eligible provider returns no usable results.

Each parallel provider request asks for two results. Firecrawl sends `{ query, limit: 2 }` and maps `data.web` entries to the existing provider-transparent title, URL, and snippet shape. The snippet uses the provider description when present, otherwise returned markdown, otherwise the standard unavailable-summary text.

Using Firecrawl only as fallback was considered and rejected because the agreed goal is result diversity from three parallel peers.

### Generalize deterministic provider interleaving

Replace pair-specific merging with an ordered provider-array merge. Results are emitted round-robin by rank in the stable order Exa → Tavily → Firecrawl and deduplicated case-insensitively by URL, retaining the first occurrence. Provider counts record received usable results before cross-provider deduplication and are included when at least two providers contribute.

This preserves current Exa/Tavily ordering while extending it predictably to a third provider.

### Insert Firecrawl Scrape after direct HTTP

The fetch cascade becomes GitHub → HTTP → Firecrawl → Cloudflare → Exa. Firecrawl receives `{ url, formats: ["markdown"], onlyMainContent: true }`; usable `data.markdown` returns source `firecrawl`. Empty content, malformed responses, HTTP failures, 429 responses, and timeouts return `null`, allowing the cascade to continue without retry.

Placing Firecrawl before HTTP was rejected because direct `text/plain` retrieval is local, fast, and does not consume an external allowance. Placing it after Cloudflare or Exa was rejected because Firecrawl is intended to close the credential gap before those credentialed fallbacks.

### Preserve existing cache and error semantics

The existing retrieval cache wraps the full cascade, so successful Firecrawl scrape results automatically use the same ten-minute TTL and source tracking. Firecrawl does not add provider-specific quota state, retries, or failure caching. Search failures are omitted from merged results; scrape failures return `null`.

## Risks / Trade-offs

- **[Risk] Parallel Firecrawl Search consumes free credits on every search** → Accept the cost for provider diversity; no credit rationing or quota tracking is included.
- **[Risk] Keyless limits are lower and may change** → Support an optional API key and treat 429 as an ordinary partial failure.
- **[Risk] Firecrawl response fields may vary between basic and scraped search results** → Parse defensively, require a URL, and use description/markdown fallbacks for snippets.
- **[Risk] A third provider increases result volume and renderer complexity** → Keep two results per provider and generalize existing provider-count data rather than adding provider labels to LLM-visible results.
- **[Risk] An external cloud service receives requested URLs and queries** → This is consistent with existing Exa, Tavily, and Cloudflare integrations; self-hosting is explicitly out of scope.
